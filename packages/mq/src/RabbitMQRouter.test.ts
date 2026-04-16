import * as base from '@lambda-event-router/base';
import { createMockSchema, createRabbitMQEvent, createRabbitMQHandlerEvent, test } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
import { createRabbitMQRouter, defineRabbitMQRoute, RabbitMQRouter } from './RabbitMQRouter.js';
import type { RabbitMQFilterInput, RabbitMQRequest } from './rabbitMQTypes.js';

type RabbitMQNext = (request: RabbitMQRequest) => Promise<void>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');
const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');

suite('RabbitMQRouter', () => {
  let router: RabbitMQRouter;

  beforeEach(() => {
    router = new RabbitMQRouter();
  });

  suite('createRabbitMQRouter', () => {
    test('creates a RabbitMQRouter instance', () => {
      const router = createRabbitMQRouter();
      expect(router).toBeInstanceOf(RabbitMQRouter);
    });
  });

  suite('defineRabbitMQRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRabbitMQRoute({
        filters: { queue: 'orders' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, bodySchema, and handler in the definition', () => {
      const bodySchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        eventSourceArn: ['arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234'],
        queue: 'orders',
        contentType: 'application/json',
      };

      const definition = defineRabbitMQRoute({
        filters,
        bodySchema,
      }).handle(handler);

      expect(definition.filters).toBe(filters);
      expect(definition.bodySchema).toBe(bodySchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid RabbitMQ event', () => {
      const event = createRabbitMQEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for wrong eventSource', () => {
      const event = { eventSource: 'aws:sqs', rmqMessagesByQueue: {} };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false when rmqMessagesByQueue is not an object', () => {
      expect(router.canHandleEvent({ eventSource: 'aws:rmq', rmqMessagesByQueue: 'not-an-object' })).toBe(false);
    });

    test('returns false for non-object input', () => {
      expect(router.canHandleEvent(42)).toBe(false);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRabbitMQRoute({
        filters: {},
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches route by eventSourceArn', ({ rabbitMQMessage }) => {
      const arn = 'arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234';
      router.route(
        defineRabbitMQRoute({
          filters: { eventSourceArn: arn },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      event.eventSourceArn = arn;
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeDefined();
    });

    test('matches route by eventSourceArn array', ({ rabbitMQMessage }) => {
      const arn = 'arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234';
      const arn2 = 'arn:aws:mq:eu-west-2:987654321098:broker:OtherBroker:z-9876';
      router.route(
        defineRabbitMQRoute({
          filters: { eventSourceArn: [arn, arn2] },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      event.eventSourceArn = arn;
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArn does not match', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { eventSourceArn: 'arn:aws:mq:us-east-1:123456789012:broker:OtherBroker:b-9999' },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeUndefined();
    });

    test('matches route by queue', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { queue: 'orders' },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'orders', message);

      expect(result).toBeDefined();
    });

    test('matches route by queue array', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { queue: ['orders', 'refunds'] },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'orders', message);

      expect(result).toBeDefined();
    });

    test('does not match when queue does not match', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { queue: 'orders' },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'users', message);

      expect(result).toBeUndefined();
    });

    test('matches route by contentType', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { contentType: 'application/json' },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage({ basicProperties: { contentType: 'application/json' } });

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeDefined();
    });

    test('matches route by contentType array', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { contentType: ['application/json', 'application/xml'] },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage({ basicProperties: { contentType: 'application/json' } });

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeDefined();
    });

    test('does not match when contentType does not match', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { contentType: 'application/xml' },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage({ basicProperties: { contentType: 'application/json' } });

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: {
            customFilter: ({ queue }: RabbitMQFilterInput): boolean => {
              return queue === 'orders';
            },
          },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'orders', message);

      expect(result).toBeDefined();
    });

    test('does not match when customFilter returns false', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeUndefined();
    });

    test('customFilter receives correct RabbitMQFilterInput', ({ rabbitMQMessage }) => {
      const filterSpy = vi.fn().mockReturnValue(true);
      router.route(
        defineRabbitMQRoute({
          filters: { customFilter: filterSpy },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage({ basicProperties: { contentType: 'text/plain' } });

      // @ts-expect-error - testing private method directly
      router.matchRoute(event, 'orders', message);

      expect(filterSpy).toHaveBeenCalledWith({
        queue: 'orders',
        contentType: 'text/plain',
        record: message,
      });
    });

    test('customFilter is not called when a preceding filter rejects', ({ rabbitMQMessage }) => {
      const customFilterSpy = vi.fn().mockReturnValue(true);
      router.route(
        defineRabbitMQRoute({
          filters: { queue: 'other-queue', customFilter: customFilterSpy },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      router.matchRoute(event, 'test-queue', message);

      expect(customFilterSpy).not.toHaveBeenCalled();
    });

    test('matches route with empty filters as a catch-all', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', ({ rabbitMQMessage }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.route(defineRabbitMQRoute({ filters: {} }).handle(firstHandler));
      router.route(defineRabbitMQRoute({ filters: {} }).handle(secondHandler));

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with correct RabbitMQRequest shape', async ({
      rabbitMQMessage,
      rabbitMQHandlerEvent,
    }) => {
      const handler = vi.fn();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const message = rabbitMQMessage();
      const { event, context } = rabbitMQHandlerEvent({
        messagesByQueue: { 'orders::/production': [message] },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: 'orders',
          record: message,
          context,
        }),
      );
    });

    test('decodes base64 message data', async ({ rabbitMQMessage, context }) => {
      const handler = vi.fn();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const body = { decoded: true };
      const message = rabbitMQMessage({ data: body }); // This gets auto encoded by rabbitMQMessage
      const event = createRabbitMQEvent({ 'test-queue::/vhost': [message] });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(1);
      const expectedDecodedData = JSON.stringify(body);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({ data: expectedDecodedData }),
          body,
        }),
      );
    });

    test('validates body with schema and returns transformed data', async ({ rabbitMQMessage, context }) => {
      const handler = vi.fn();
      const bodySchema = createMockSchema();
      router.route(defineRabbitMQRoute({ filters: {}, bodySchema }).handle(handler));

      const body = { action: 'process' };
      const message = rabbitMQMessage({ data: body });
      const event = createRabbitMQEvent({ 'test-queue::/vhost': [message] });
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith(body, bodySchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body }));
    });

    test('throws when body schema validation fails', async ({ rabbitMQMessage, context }) => {
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      router.route(defineRabbitMQRoute({ filters: {}, bodySchema }).handle(vi.fn()));

      const message = rabbitMQMessage({ data: { bad: 'data' } });
      const event = createRabbitMQEvent({ 'test-queue::/vhost': [message] });

      await expect(router.handleEvent(event, context())).rejects.toThrow('Body validation failed');
    });

    test('parses queue name from queueName::virtualHost format', async ({ rabbitMQMessage, context }) => {
      const handler = vi.fn();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const message = rabbitMQMessage();
      const event = createRabbitMQEvent({ 'orders::/production': [message] });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ queue: 'orders' }));
    });

    test('uses full key as queue name when no :: separator', async ({ rabbitMQMessage, context }) => {
      const handler = vi.fn();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const message = rabbitMQMessage();
      const event = createRabbitMQEvent({ 'simple-queue': [message] });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ queue: 'simple-queue' }));
    });

    test('throws when no route matches', async ({ rabbitMQHandlerEvent }) => {
      const { event, context } = rabbitMQHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler errors', async ({ rabbitMQHandlerEvent }) => {
      router.route(
        defineRabbitMQRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = rabbitMQHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('returns undefined on success', async ({ rabbitMQHandlerEvent }) => {
      router.route(defineRabbitMQRoute({ filters: {} }).handle(async () => {}));

      const { event, context } = rabbitMQHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('processes messages sequentially across queue', async ({ rabbitMQMessage, context }) => {
      const callOrder: string[] = [];

      router.route(
        defineRabbitMQRoute({ filters: {} }).handle(async (request: RabbitMQRequest) => {
          const queue = request.queue;
          callOrder.push(`start-${queue}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${queue}`);
        }),
      );

      const event = createRabbitMQEvent({
        'queue-a::/vhost': [rabbitMQMessage()],
        'queue-b::/vhost': [rabbitMQMessage()],
      });
      await router.handleEvent(event, context());

      expect(callOrder).toEqual(['start-queue-a', 'end-queue-a', 'start-queue-b', 'end-queue-b']);
    });

    test('processes messages from multiple queue', async ({ rabbitMQMessage, context }) => {
      const handler = vi.fn();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const event = createRabbitMQEvent({
        'queue-a::/vhost': [rabbitMQMessage(), rabbitMQMessage()],
        'queue-b::/vhost': [rabbitMQMessage()],
      });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  suite('handleEvent - jsonParse', () => {
    test('passes decoded message data to safeJsonParse', async ({ rabbitMQMessage, context }) => {
      const handler = vi.fn();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const body = { action: 'process', id: '123' };
      const message = rabbitMQMessage({ data: body });
      const event = createRabbitMQEvent({ 'test-queue::/vhost': [message] });
      await router.handleEvent(event, context());

      expect(safeJsonParseSpy).toHaveBeenCalledWith(JSON.stringify(body));
    });

    test('handler receives parsed object when data is valid JSON', async ({ rabbitMQMessage, context }) => {
      const handler = vi.fn();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const body = { action: 'process', id: '123' };
      const message = rabbitMQMessage({ data: body });
      const event = createRabbitMQEvent({ 'test-queue::/vhost': [message] });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body }));
    });

    test('handler receives raw string when data is not valid JSON', async ({ rabbitMQMessage, context }) => {
      const handler = vi.fn();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const message = rabbitMQMessage({ data: 'not-json' });
      const event = createRabbitMQEvent({ 'test-queue::/vhost': [message] });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: 'not-json' }));
    });
  });

  suite('full event processing', () => {
    test('routes messages from different queue to different handlers', async ({ rabbitMQMessage, context }) => {
      const ordersHandler = vi.fn();
      const usersHandler = vi.fn();

      router.route(defineRabbitMQRoute({ filters: { queue: 'orders' } }).handle(ordersHandler));
      router.route(defineRabbitMQRoute({ filters: { queue: 'users' } }).handle(usersHandler));

      const event = createRabbitMQEvent({
        'orders::/vhost': [rabbitMQMessage()],
        'users::/vhost': [rabbitMQMessage()],
      });
      await router.handleEvent(event, context());

      expect(ordersHandler).toHaveBeenCalledTimes(1);
      expect(usersHandler).toHaveBeenCalledTimes(1);
    });

    test('routes by contentType to different handlers', async ({ rabbitMQMessage, context }) => {
      const jsonHandler = vi.fn();
      const xmlHandler = vi.fn();

      router.route(defineRabbitMQRoute({ filters: { contentType: 'application/json' } }).handle(jsonHandler));
      router.route(defineRabbitMQRoute({ filters: { contentType: 'application/xml' } }).handle(xmlHandler));

      const event = createRabbitMQEvent({
        'test-queue::/vhost': [
          rabbitMQMessage({ basicProperties: { contentType: 'application/json' } }),
          rabbitMQMessage({ basicProperties: { contentType: 'application/xml' } }),
        ],
      });
      await router.handleEvent(event, context());

      expect(jsonHandler).toHaveBeenCalledTimes(1);
      expect(xmlHandler).toHaveBeenCalledTimes(1);
    });

    test('catch-all route handles all messages', async ({ rabbitMQMessage, context }) => {
      const handler = vi.fn();

      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const event = createRabbitMQEvent({
        'queue-a::/vhost': [rabbitMQMessage()],
        'queue-b::/vhost': [rabbitMQMessage(), rabbitMQMessage()],
      });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async () => {
      const callOrder: string[] = [];

      async function middleware(request: RabbitMQRequest, next: RabbitMQNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createRabbitMQRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = createRabbitMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('executes middleware per-record for multi-record events', async ({ rabbitMQMessage, context }) => {
      const recordIds: string[] = [];

      async function middleware(request: RabbitMQRequest, next: RabbitMQNext): Promise<void> {
        recordIds.push(request.record.basicProperties.messageId ?? '');
        await next(request);
      }

      const router = createRabbitMQRouter({ middleware: [middleware] });
      router.route({ filters: {}, handler: async () => {} });

      const messageOne = rabbitMQMessage({ basicProperties: { messageId: 'msg-1' } });
      const messageTwo = rabbitMQMessage({ basicProperties: { messageId: 'msg-2' } });
      const event = createRabbitMQEvent({ 'test-queue::/vhost': [messageOne, messageTwo] });
      await router.handleEvent(event, context());

      expect(recordIds).toEqual(['msg-1', 'msg-2']);
    });

    test('allows middleware to skip a record by not calling next', async () => {
      const handler = vi.fn();

      async function skipMiddleware(_request: RabbitMQRequest, _next: RabbitMQNext): Promise<void> {
        return;
      }

      const router = createRabbitMQRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = createRabbitMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async () => {
      const callOrder: string[] = [];

      async function middlewareOne(request: RabbitMQRequest, next: RabbitMQNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: RabbitMQRequest, next: RabbitMQNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createRabbitMQRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = createRabbitMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async () => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: RabbitMQRequest, next: RabbitMQNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = createRabbitMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: RabbitMQRequest, _next: RabbitMQNext): Promise<void> {
        return;
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = createRabbitMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async () => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: RabbitMQRequest, next: RabbitMQNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: RabbitMQRequest, next: RabbitMQNext): Promise<void> {
        callOrder.push('route-mw2');
        await next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = createRabbitMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async () => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: RabbitMQRequest, next: RabbitMQNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRabbitMQRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });

      router.route(route);

      const { event, context } = createRabbitMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async () => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: RabbitMQRequest, next: RabbitMQNext): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: RabbitMQRequest, next: RabbitMQNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createRabbitMQRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = createRabbitMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async () => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: RabbitMQRequest, _next: RabbitMQNext): Promise<void> {
        return;
      }

      const router = createRabbitMQRouter({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = createRabbitMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async () => {
      const middleware = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const router = createRabbitMQRouter({ middleware: [middleware] });
      router.route({ filters: {}, bodySchema, handler: vi.fn() });

      const { event, context } = createRabbitMQHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('validation failed');
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});
