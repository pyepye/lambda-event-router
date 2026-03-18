import type { Schema } from '@lambda-event-router/base';
import { createRabbitMQEvent, test } from '@lambda-event-router/testing';
import { createRabbitMQRouter, defineRabbitMQRoute, RabbitMQRouter } from './RabbitMQRouter.js';
import type { RabbitMQFilterInput, RabbitMQRequest } from './rabbitMQTypes.js';

suite('RabbitMQRouter', () => {
  suite('createRabbitMQRouter', () => {
    test('creates a RabbitMQRouter instance', () => {
      const router = createRabbitMQRouter();
      expect(router).toBeInstanceOf(RabbitMQRouter);
    });
  });

  suite('defineRabbitMQRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRabbitMQRoute({
        filters: { queues: ['orders'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, bodySchema, and handler in the definition', () => {
      const bodySchema: Schema<{ action: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { action: string } }),
      };
      const handler = vi.fn();
      const filters = {
        eventSourceArns: ['arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234'],
        queues: ['orders'],
        contentTypes: ['application/json'],
      };

      const definition = defineRabbitMQRoute({
        filters,
        bodySchema,
      }).handle(handler);

      expect(definition).toEqual({
        filters,
        bodySchema,
        handler,
      });
    });
  });

  suite('canHandleEvent', () => {
    let router: RabbitMQRouter;

    beforeEach(() => {
      router = new RabbitMQRouter();
    });

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
      const router = new RabbitMQRouter();
      const definition = defineRabbitMQRoute({
        filters: {},
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    let router: RabbitMQRouter;

    beforeEach(() => {
      router = createRabbitMQRouter();
    });

    test('matches route by eventSourceArns', ({ rabbitMQMessage }) => {
      const arn = 'arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234';
      router.route(
        defineRabbitMQRoute({
          filters: { eventSourceArns: [arn] },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      event.eventSourceArn = arn;
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArns does not match', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { eventSourceArns: ['arn:aws:mq:us-east-1:123456789012:broker:OtherBroker:b-9999'] },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeUndefined();
    });

    test('matches route by queues', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { queues: ['orders'] },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'orders', message);

      expect(result).toBeDefined();
    });

    test('does not match when queues does not match', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { queues: ['orders'] },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'users', message);

      expect(result).toBeUndefined();
    });

    test('matches route by contentTypes', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { contentTypes: ['application/json'] },
        }).handle(async () => {}),
      );

      const event = createRabbitMQEvent();
      const message = rabbitMQMessage({ basicProperties: { contentType: 'application/json' } });

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, 'test-queue', message);

      expect(result).toBeDefined();
    });

    test('does not match when contentTypes does not match', ({ rabbitMQMessage }) => {
      router.route(
        defineRabbitMQRoute({
          filters: { contentTypes: ['application/xml'] },
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
          filters: { queues: ['other-queue'], customFilter: customFilterSpy },
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
      // @ts-expect-error - result is asserted as defined above
      expect(result.handler).toBe(firstHandler);
    });
  });

  suite('parseJsonBody', () => {
    let router: RabbitMQRouter;

    beforeEach(() => {
      router = new RabbitMQRouter();
    });

    test('parses valid JSON string into an object', () => {
      // @ts-expect-error - testing private method directly
      const result = router.parseJsonBody('{"action":"process"}');

      expect(result).toEqual({ action: 'process' });
    });

    test('returns raw string when data is not valid JSON', () => {
      // @ts-expect-error - testing private method directly
      const result = router.parseJsonBody('not-json');

      expect(result).toBe('not-json');
    });
  });

  suite('validateBody', () => {
    let router: RabbitMQRouter;

    beforeEach(() => {
      router = new RabbitMQRouter();
    });

    test('returns pre-parsed body when no schema', () => {
      const body = { action: 'process' };

      // @ts-expect-error - testing private method directly
      const result = router.validateBody(body, undefined, 'orders');

      expect(result).toBe(body);
    });

    test('returns validated data on schema success', () => {
      const body = { action: 'process' };
      const transformedData = { action: 'process', validated: true };
      const schema: Schema<typeof transformedData> = {
        safeParse: () => ({ success: true, data: transformedData }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateBody(body, schema, 'orders');

      expect(result).toEqual(transformedData);
    });

    test('throws on JSON parse failure when body is still a string', () => {
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: true, data: {} }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateBody('not-json', schema, 'orders')).toThrow(
        'Failed to parse JSON body for message on queue orders',
      );
    });

    test('throws on schema validation failure', () => {
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateBody({ valid: 'json' }, schema, 'orders')).toThrow(
        'Body validation failed for message on queue orders',
      );
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with correct RabbitMQRequest shape', async ({
      rabbitMQMessage,
      rabbitMQHandlerEvent,
    }) => {
      const router = createRabbitMQRouter();
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
      const router = createRabbitMQRouter();
      const handler = vi.fn();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const body = { decoded: true };
      const message = rabbitMQMessage({ data: body }); // This gets auto encoded by activeMQMessage
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

    test('parses queue name from queueName::virtualHost format', async ({ rabbitMQMessage, context }) => {
      const router = createRabbitMQRouter();
      const handler = vi.fn();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const message = rabbitMQMessage();
      const event = createRabbitMQEvent({ 'orders::/production': [message] });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ queue: 'orders' }));
    });

    test('uses full key as queue name when no :: separator', async ({ rabbitMQMessage, context }) => {
      const router = createRabbitMQRouter();
      const handler = vi.fn();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const message = rabbitMQMessage();
      const event = createRabbitMQEvent({ 'simple-queue': [message] });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ queue: 'simple-queue' }));
    });

    test('throws when no route matches', async ({ rabbitMQHandlerEvent }) => {
      const router = createRabbitMQRouter();

      const { event, context } = rabbitMQHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler errors', async ({ rabbitMQHandlerEvent }) => {
      const router = createRabbitMQRouter();
      router.route(
        defineRabbitMQRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = rabbitMQHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('returns undefined on success', async ({ rabbitMQHandlerEvent }) => {
      const router = createRabbitMQRouter();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(async () => {}));

      const { event, context } = rabbitMQHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('processes messages sequentially across queues', async ({ rabbitMQMessage, context }) => {
      const router = createRabbitMQRouter();
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

    test('processes messages from multiple queues', async ({ rabbitMQMessage, context }) => {
      const router = createRabbitMQRouter();
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

  suite('full event processing', () => {
    test('routes messages from different queues to different handlers', async ({ rabbitMQMessage, context }) => {
      const ordersHandler = vi.fn();
      const usersHandler = vi.fn();

      const router = createRabbitMQRouter();
      router.route(defineRabbitMQRoute({ filters: { queues: ['orders'] } }).handle(ordersHandler));
      router.route(defineRabbitMQRoute({ filters: { queues: ['users'] } }).handle(usersHandler));

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

      const router = createRabbitMQRouter();
      router.route(defineRabbitMQRoute({ filters: { contentTypes: ['application/json'] } }).handle(jsonHandler));
      router.route(defineRabbitMQRoute({ filters: { contentTypes: ['application/xml'] } }).handle(xmlHandler));

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

      const router = createRabbitMQRouter();
      router.route(defineRabbitMQRoute({ filters: {} }).handle(handler));

      const event = createRabbitMQEvent({
        'queue-a::/vhost': [rabbitMQMessage()],
        'queue-b::/vhost': [rabbitMQMessage(), rabbitMQMessage()],
      });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });
});
