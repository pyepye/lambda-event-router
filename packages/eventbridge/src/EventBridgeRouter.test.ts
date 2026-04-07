import * as base from '@lambda-event-router/base';
import { createEventBridgeEvent, createMockSchema, test } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
import { createEventBridgeRouter, defineRoute, EventBridgeRouter } from './EventBridgeRouter.js';
import type { EventBridgeFilterInput, EventBridgeRequest } from './types.js';

type EventBridgeNext = (request: EventBridgeRequest) => Promise<void>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');

suite('EventBridgeRouter', () => {
  let router: EventBridgeRouter;

  beforeEach(() => {
    router = new EventBridgeRouter();
  });

  suite('createEventBridgeRouter', () => {
    test('creates an EventBridgeRouter instance', () => {
      const router = createEventBridgeRouter();
      expect(router).toBeInstanceOf(EventBridgeRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for an EventBridge envelope event', () => {
      const event = createEventBridgeEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for an object without source', () => {
      expect(router.canHandleEvent({ 'detail-type': 'Test', detail: {} })).toBe(false);
    });

    test('returns false for an object without detail-type', () => {
      expect(router.canHandleEvent({ source: 'my.app', detail: {} })).toBe(false);
    });

    test('returns false for an object without detail', () => {
      expect(router.canHandleEvent({ source: 'my.app', 'detail-type': 'Test' })).toBe(false);
    });

    test('returns false for an arbitrary object without envelope fields', () => {
      expect(router.canHandleEvent({ taskId: 'task-123' })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('preserves filters, detailSchema, and handler in EventBridge definition', () => {
      const detailSchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        sources: ['order.service'],
        detailTypes: ['OrderPlaced'],
      };

      const definition = defineRoute({
        filters,
        detailSchema,
      }).handle(handler);

      expect(definition.filters).toEqual(filters);
      expect(definition.detailSchema).toBe(detailSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: { sources: ['my.app'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches route by sources filter', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { sources: ['my.app'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when sources filter does not match', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { sources: ['other.app'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by detailTypes filter', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { detailTypes: ['OrderPlaced'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when detailTypes filter does not match', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { detailTypes: ['OrderShipped'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by accounts filter', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { accounts: ['123456789012'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when accounts filter does not match', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { accounts: ['999999999999'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by regions filter', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { regions: ['us-east-1'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when regions filter does not match', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { regions: ['eu-west-1'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by resources filter', ({ eventBridgeEvent }) => {
      const resourceArn = 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0';
      router.route(
        defineRoute({
          filters: { resources: [resourceArn] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent({ resources: [resourceArn] });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when resources filter does not match', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { resources: ['arn:aws:ec2:us-east-1:123456789012:instance/i-other'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent({
        resources: ['arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0'],
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches when all standard filters match together', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            sources: ['my.app'],
            detailTypes: ['OrderPlaced'],
            accounts: ['123456789012'],
            regions: ['us-east-1'],
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match when one of multiple standard filters mismatches', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            sources: ['my.app'],
            detailTypes: ['OrderPlaced'],
            accounts: ['999999999999'],
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ detail }: EventBridgeFilterInput): boolean => {
              // @ts-expect-error - detail is unknown, testing filter with known shape
              return detail.orderId === '12345';
            },
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('selects the first matching route when multiple routes match', ({ eventBridgeEvent }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.route(
        defineRoute({
          filters: { sources: ['my.app'] },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { sources: ['my.app'] },
        }).handle(secondHandler),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('matches when standard filters and customFilter both pass', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            sources: ['my.app'],
            customFilter: ({ detail }: EventBridgeFilterInput): boolean => {
              // @ts-expect-error - detail is unknown, testing filter with known shape
              return detail.orderId === '12345';
            },
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match when standard filters pass but customFilter returns false', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            sources: ['my.app'],
            customFilter: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches when event has multiple resources and filter matches one', ({ eventBridgeEvent }) => {
      const arnA = 'arn:aws:ec2:us-east-1:123456789012:instance/i-aaaa';
      const arnB = 'arn:aws:ec2:us-east-1:123456789012:instance/i-bbbb';

      router.route(
        defineRoute({
          filters: { resources: [arnB] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent({ resources: [arnA, arnB] });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('passes correct filterInput to customFilter', ({ eventBridgeEvent }) => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: { customFilter },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      router.matchRoute(event);

      expect(customFilter).toHaveBeenCalledWith({
        event,
        source: event.source,
        detailType: event['detail-type'],
        detail: event.detail,
      });
    });
  });

  suite('handleEvent', () => {
    test('calls handler with complete EventBridgeRequest properties', async ({ eventBridgeEvent, context }) => {
      const handler = vi.fn();
      const definition = defineRoute({
        filters: { sources: ['my.app'] },
      }).handle(handler);
      router.route(definition);

      const event = eventBridgeEvent({
        resources: ['arn:aws:events:us-east-1:123456789012:rule/my-rule'],
      });
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(handler).toHaveBeenCalledWith({
        source: event.source,
        detailType: event['detail-type'],
        detail: event.detail,
        account: event.account,
        region: event.region,
        time: event.time,
        resources: event.resources,
        id: event.id,
        event,
        context: mockContext,
      });
    });

    suite('no route matched', () => {
      test('throws with source and detail-type info for unmatched EventBridge event', async ({
        eventBridgeEvent,
        context,
      }) => {
        const event = eventBridgeEvent({
          source: 'payment.service',
          'detail-type': 'PaymentFailed',
        });
        await expect(router.handleEvent(event, context())).rejects.toThrow(
          'No route matched for EventBridge event: payment.service / PaymentFailed',
        );
      });
    });
  });

  suite('handleEvent - schema validation', () => {
    test('handler receives validated detail from detailSchema', async ({ eventBridgeEvent, context }) => {
      const handler = vi.fn();
      const detailSchema = createMockSchema();
      router.route(
        defineRoute({
          filters: { sources: ['my.app'] },
          detailSchema,
        }).handle(handler),
      );

      const event = eventBridgeEvent();
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(validateSchemaSpy).toHaveBeenCalledWith(event.detail, detailSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ detail: event.detail }));
    });

    test('throws when detailSchema validation fails', async ({ eventBridgeEvent, context }) => {
      const detailSchema = createMockSchema({ issues: [{ message: 'invalid detail' }] });
      router.route(
        defineRoute({
          filters: { sources: ['my.app'] },
          detailSchema,
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      await expect(router.handleEvent(event, context())).rejects.toThrow('Schema validation failed for event');
    });
  });

  suite('full event processing', () => {
    test('routes EventBridge events based on source filters', async ({ eventBridgeEvent, context }) => {
      const receivedOrderRequests: EventBridgeRequest[] = [];
      const receivedPaymentRequests: EventBridgeRequest[] = [];
      router.route(
        defineRoute({
          filters: { sources: ['order.service'] },
        }).handle(async (request) => {
          receivedOrderRequests.push(request);
        }),
      );
      router.route(
        defineRoute({
          filters: { sources: ['payment.service'] },
        }).handle(async (request) => {
          receivedPaymentRequests.push(request);
        }),
      );

      const event = eventBridgeEvent({ source: 'order.service' });
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(receivedOrderRequests).toHaveLength(1);
      expect(receivedOrderRequests[0]).toEqual(
        expect.objectContaining({
          source: 'order.service',
          detailType: event['detail-type'],
          detail: event.detail,
          id: event.id,
          event,
          context: mockContext,
        }),
      );
      expect(receivedPaymentRequests).toHaveLength(0);
    });

    test('routes events to different handlers based on detailType filters', async ({ eventBridgeEvent, context }) => {
      const orderPlacedHandler = vi.fn();
      const orderShippedHandler = vi.fn();
      router.route(
        defineRoute({
          filters: { detailTypes: ['OrderPlaced'] },
        }).handle(orderPlacedHandler),
      );
      router.route(
        defineRoute({
          filters: { detailTypes: ['OrderShipped'] },
        }).handle(orderShippedHandler),
      );

      const mockContext = context();
      await router.handleEvent(eventBridgeEvent(), mockContext);
      await router.handleEvent(eventBridgeEvent({ 'detail-type': 'OrderShipped' }), mockContext);

      expect(orderPlacedHandler).toHaveBeenCalledTimes(1);
      expect(orderShippedHandler).toHaveBeenCalledTimes(1);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ eventBridgeHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createEventBridgeRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = eventBridgeHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ eventBridgeHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: EventBridgeRequest, _next: EventBridgeNext): Promise<void> {
        return;
      }

      const router = createEventBridgeRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = eventBridgeHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ eventBridgeHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createEventBridgeRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = eventBridgeHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ eventBridgeHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
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

      const { event, context } = eventBridgeHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ eventBridgeHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: EventBridgeRequest, _next: EventBridgeNext): Promise<void> {
        return;
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = eventBridgeHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ eventBridgeHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
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

      const { event, context } = eventBridgeHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ eventBridgeHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });

      router.route(route);

      const { event, context } = eventBridgeHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ eventBridgeHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createEventBridgeRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = eventBridgeHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({
      eventBridgeHandlerEvent,
    }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: EventBridgeRequest, _next: EventBridgeNext): Promise<void> {
        return;
      }

      const router = createEventBridgeRouter({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = eventBridgeHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async ({ eventBridgeHandlerEvent }) => {
      const middleware = vi.fn();
      const detailSchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const router = createEventBridgeRouter({ middleware: [middleware] });
      router.route({ filters: {}, detailSchema, handler: vi.fn() });

      const { event, context } = eventBridgeHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('Schema validation failed');
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});
