import type { MockInstance } from 'vitest';

import * as base from '@latcher/base';
import { allEventBuilders, createEventBridgeEvent, createMockSchema, test } from '@latcher/testing';

import { createEventBridgeMatcher, defineRoute, EventBridgeMatcher } from './EventBridgeMatcher.js';
import type { EventBridgeFilterInput, EventBridgeRequest } from './types.js';

type EventBridgeNext = (request: EventBridgeRequest) => Promise<void>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');

suite('EventBridgeMatcher', () => {
  let matcher: EventBridgeMatcher;

  beforeEach(() => {
    matcher = new EventBridgeMatcher();
  });

  suite('createEventBridgeMatcher', () => {
    test('creates an EventBridgeMatcher instance', () => {
      const matcher = createEventBridgeMatcher();
      expect(matcher).toBeInstanceOf(EventBridgeMatcher);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for an EventBridge envelope event', () => {
      const event = createEventBridgeEvent();
      expect(matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(matcher.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(matcher.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for an object without source', () => {
      expect(matcher.canHandleEvent({ 'detail-type': 'Test', detail: {} })).toBe(false);
    });

    test('returns false for an object without detail-type', () => {
      expect(matcher.canHandleEvent({ source: 'my.app', detail: {} })).toBe(false);
    });

    test('returns false for an object without detail', () => {
      expect(matcher.canHandleEvent({ source: 'my.app', 'detail-type': 'Test' })).toBe(false);
    });

    test('returns false for an arbitrary object without envelope fields', () => {
      expect(matcher.canHandleEvent({ taskId: 'task-123' })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('preserves filters, detailSchema, and handler in EventBridge definition', () => {
      const detailSchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        source: 'order.service',
        detailType: 'OrderPlaced',
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
    test('returns the matcher instance for chaining', () => {
      const definition = defineRoute({
        filters: { source: 'my.app' },
      }).handle(async () => {});

      const result = matcher.route(definition);

      expect(result).toBe(matcher);
    });
  });

  suite('matchRoute', () => {
    test('matches route by source filter', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { source: 'my.app' },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match when source is an empty string', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { source: '' },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by source filter array', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { source: ['my.app', 'other.app'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when source filter does not match', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { source: 'other.app' },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by detailType filter', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { detailType: 'OrderPlaced' },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('matches route by detailType filter array', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { detailType: ['OrderPlaced', 'OrderRefunded'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when detailType filter does not match', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { detailType: 'OrderShipped' },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by account filter', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { account: '123456789012' },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('matches route by account filter array', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { account: ['123456789012', '987654321098'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when account filter does not match', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { account: '999999999999' },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by region filter', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { region: 'us-east-1' },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('matches route by region filter array', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { region: ['us-east-1', 'eu-west-2'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when region filter does not match', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { region: 'eu-west-1' },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by resource filter', async ({ eventBridgeEvent }) => {
      const resourceArn = 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0';
      matcher.route(
        defineRoute({
          filters: { resource: resourceArn },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent({ resources: [resourceArn] });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('matches route by resource filter array', async ({ eventBridgeEvent }) => {
      const resourceArn = 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0';
      const resourceArn2 = 'arn:aws:ec2:eu-west-1:987654321098:instance/i-9876543210zyxwvu9';
      matcher.route(
        defineRoute({
          filters: { resource: [resourceArn, resourceArn2] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent({ resources: [resourceArn] });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when resource filter does not match', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { resource: 'arn:aws:ec2:us-east-1:123456789012:instance/i-other' },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent({
        resources: ['arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0'],
      });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches when all standard filters match together', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: {
            source: 'my.app',
            detailType: 'OrderPlaced',
            account: '123456789012',
            region: 'us-east-1',
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match when one of multiple standard filters mismatches', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: {
            source: 'my.app',
            detailType: 'OrderPlaced',
            account: '999999999999',
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by custom', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: {
            custom: ({ detail }: EventBridgeFilterInput): boolean => {
              // @ts-expect-error - detail is unknown, testing filter with known shape
              return detail.orderId === '12345';
            },
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('matches route by async custom', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: {
            custom: async ({ detail }: EventBridgeFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              // @ts-expect-error - detail is unknown, testing filter with known shape
              return detail.orderId === '12345';
            },
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when custom returns false', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: {
            custom: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('selects the first matching route when multiple routes match', async ({ eventBridgeEvent }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      matcher.route(
        defineRoute({
          filters: { source: 'my.app' },
        }).handle(firstHandler),
      );
      matcher.route(
        defineRoute({
          filters: { source: 'my.app' },
        }).handle(secondHandler),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('orders an exact source ahead of the wildcard that covers it', async ({ eventBridgeEvent }) => {
      const wildcard = vi.fn();
      const exact = vi.fn();

      matcher.route(defineRoute({ filters: { source: 'my.*' } }).handle(wildcard));
      matcher.route(defineRoute({ filters: { source: 'my.app' } }).handle(exact));

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result?.handler).toBe(exact);
    });

    test('orders a guarded route ahead of the fallback it shares filters with', async ({ eventBridgeEvent }) => {
      const fallback = vi.fn();
      const guarded = vi.fn();

      matcher.route(defineRoute({ filters: { source: 'my.app' } }).handle(fallback));
      matcher.route(defineRoute({ filters: { source: 'my.app', custom: () => true } }).handle(guarded));

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result?.handler).toBe(guarded);
    });

    test('matches when standard filters and custom both pass', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: {
            source: 'my.app',
            custom: ({ detail }: EventBridgeFilterInput): boolean => {
              // @ts-expect-error - detail is unknown, testing filter with known shape
              return detail.orderId === '12345';
            },
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match when standard filters pass but custom returns false', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: {
            source: 'my.app',
            custom: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches when event has multiple resources and filter matches one', async ({ eventBridgeEvent }) => {
      const arnA = 'arn:aws:ec2:us-east-1:123456789012:instance/i-aaaa';
      const arnB = 'arn:aws:ec2:us-east-1:123456789012:instance/i-bbbb';

      matcher.route(
        defineRoute({
          filters: { resource: arnB },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent({ resources: [arnA, arnB] });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('matches when filter source is an array and event source is one of them', async ({ eventBridgeEvent }) => {
      matcher.route(
        defineRoute({
          filters: { source: ['my.app', 'other.app'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent({ source: 'other.app' });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('passes correct filterInput to custom', async ({ eventBridgeEvent }) => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.route(
        defineRoute({
          filters: { custom },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      matcher.matchRoute(event);

      expect(custom).toHaveBeenCalledWith({
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
        filters: { source: 'my.app' },
      }).handle(handler);
      matcher.route(definition);

      const event = eventBridgeEvent({
        resources: ['arn:aws:events:us-east-1:123456789012:rule/my-rule'],
      });
      const mockContext = context();
      await matcher.handleEvent(event, mockContext);

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
        await expect(matcher.handleEvent(event, context())).rejects.toThrow(
          'No route matched for EventBridge event: payment.service / PaymentFailed',
        );
      });
    });
  });

  suite('handleEvent - schema validation', () => {
    test('handler receives validated detail from detailSchema', async ({ eventBridgeEvent, context }) => {
      const handler = vi.fn();
      const detailSchema = createMockSchema();
      matcher.route(
        defineRoute({
          filters: { source: 'my.app' },
          detailSchema,
        }).handle(handler),
      );

      const event = eventBridgeEvent();
      const mockContext = context();
      await matcher.handleEvent(event, mockContext);

      expect(validateSchemaSpy).toHaveBeenCalledWith(event.detail, detailSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ detail: event.detail }));
    });

    test('throws when detailSchema validation fails', async ({ eventBridgeEvent, context }) => {
      const detailSchema = createMockSchema({ issues: [{ message: 'invalid detail' }] });
      matcher.route(
        defineRoute({
          filters: { source: 'my.app' },
          detailSchema,
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      await expect(matcher.handleEvent(event, context())).rejects.toThrow('Schema validation failed for event');
    });
  });

  suite('full event processing', () => {
    test('routes EventBridge events based on source filters', async ({ eventBridgeEvent, context }) => {
      const receivedOrderRequests: EventBridgeRequest[] = [];
      const receivedPaymentRequests: EventBridgeRequest[] = [];
      matcher.route(
        defineRoute({
          filters: { source: 'order.service' },
        }).handle(async (request) => {
          receivedOrderRequests.push(request);
        }),
      );
      matcher.route(
        defineRoute({
          filters: { source: 'payment.service' },
        }).handle(async (request) => {
          receivedPaymentRequests.push(request);
        }),
      );

      const event = eventBridgeEvent({ source: 'order.service' });
      const mockContext = context();
      await matcher.handleEvent(event, mockContext);

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
      matcher.route(
        defineRoute({
          filters: { detailType: 'OrderPlaced' },
        }).handle(orderPlacedHandler),
      );
      matcher.route(
        defineRoute({
          filters: { detailType: 'OrderShipped' },
        }).handle(orderShippedHandler),
      );

      const mockContext = context();
      await matcher.handleEvent(eventBridgeEvent(), mockContext);
      await matcher.handleEvent(eventBridgeEvent({ 'detail-type': 'OrderShipped' }), mockContext);

      expect(orderPlacedHandler).toHaveBeenCalledTimes(1);
      expect(orderShippedHandler).toHaveBeenCalledTimes(1);
    });
  });

  suite('matcher-level middleware', () => {
    test('executes middleware before the route handler', async ({ eventBridgeHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const matcher = createEventBridgeMatcher({ middleware: [middleware] });
      matcher.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = eventBridgeHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ eventBridgeHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: EventBridgeRequest, _next: EventBridgeNext): Promise<void> {
        return;
      }

      const matcher = createEventBridgeMatcher({ middleware: [skipMiddleware] });
      matcher.route({ filters: {}, handler });

      const { event, context } = eventBridgeHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple matcher-level middleware in order', async ({ eventBridgeHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const matcher = createEventBridgeMatcher({ middleware: [middlewareOne, middlewareTwo] });
      matcher.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = eventBridgeHandlerEvent();
      await matcher.handleEvent(event, context);

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

      matcher.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = eventBridgeHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ eventBridgeHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: EventBridgeRequest, _next: EventBridgeNext): Promise<void> {
        return;
      }

      matcher.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = eventBridgeHandlerEvent();
      await matcher.handleEvent(event, context);

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

      matcher.route({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = eventBridgeHandlerEvent();
      await matcher.handleEvent(event, context);

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

      matcher.route(route);

      const { event, context } = eventBridgeHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined matcher and route middleware', () => {
    test('executes matcher middleware before route middleware', async ({ eventBridgeHandlerEvent }) => {
      const callOrder: string[] = [];

      async function matcherMiddleware(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('matcher-mw');
        await next(request);
      }

      async function routeMiddleware(request: EventBridgeRequest, next: EventBridgeNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const matcher = createEventBridgeMatcher({ middleware: [matcherMiddleware] });
      matcher.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = eventBridgeHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });

    test('matcher middleware short-circuit prevents route middleware from running', async ({
      eventBridgeHandlerEvent,
    }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingMatcherMiddleware(_request: EventBridgeRequest, _next: EventBridgeNext): Promise<void> {
        return;
      }

      const matcher = createEventBridgeMatcher({ middleware: [blockingMatcherMiddleware] });
      matcher.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = eventBridgeHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async ({ eventBridgeHandlerEvent }) => {
      const middleware = vi.fn();
      const detailSchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const matcher = createEventBridgeMatcher({ middleware: [middleware] });
      matcher.route({ filters: {}, detailSchema, handler: vi.fn() });

      const { event, context } = eventBridgeHandlerEvent();
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('Schema validation failed');
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});

suite('EventBridgeMatcher.canHandleEvent', () => {
  const ownEvents = ['createEventBridgeEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createEventBridgeMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
