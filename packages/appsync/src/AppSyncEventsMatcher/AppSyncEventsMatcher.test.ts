import {
  allEventBuilders,
  createAppSyncEventsEvent,
  createMockContext,
  createMockSchema,
  test,
} from '@latcher/testing';

import { AppSyncEventsMatcher, createAppSyncEventsMatcher, defineEventsRoute } from './AppSyncEventsMatcher.js';
import type {
  AppSyncEventsOutgoingEvent,
  AppSyncEventsPublishResult,
  AppSyncEventsRequest,
  AppSyncEventsSubscribeResult,
} from './types.js';

type EventsNext = (request: AppSyncEventsRequest) => Promise<unknown>;

let matcher: AppSyncEventsMatcher;

beforeEach(() => {
  matcher = new AppSyncEventsMatcher();
});

suite('AppSyncEventsMatcher', () => {
  suite('createAppSyncEventsMatcher', () => {
    test('creates an AppSyncEventsMatcher instance', () => {
      const matcher = createAppSyncEventsMatcher();
      expect(matcher).toBeInstanceOf(AppSyncEventsMatcher);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid AppSync events event', () => {
      const event = createAppSyncEventsEvent();
      expect(matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(matcher.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(matcher.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when info is missing', () => {
      expect(matcher.canHandleEvent({ events: [] })).toBe(false);
    });

    test('returns false when info is not an object', () => {
      expect(matcher.canHandleEvent({ info: 'not-an-object' })).toBe(false);
    });

    test('returns false when channel is missing', () => {
      expect(
        matcher.canHandleEvent({
          info: { channelNamespace: { name: 'default' }, operation: 'PUBLISH' },
        }),
      ).toBe(false);
    });

    test('returns false when channel is not an object', () => {
      expect(
        matcher.canHandleEvent({
          info: { channel: 'not-object', channelNamespace: { name: 'default' }, operation: 'PUBLISH' },
        }),
      ).toBe(false);
    });

    test('returns false when channelNamespace is missing', () => {
      expect(
        matcher.canHandleEvent({
          info: { channel: { path: '/default/ch' }, operation: 'PUBLISH' },
        }),
      ).toBe(false);
    });

    test('returns false when channelNamespace is not an object', () => {
      expect(
        matcher.canHandleEvent({
          info: { channel: { path: '/default/ch' }, channelNamespace: 'not-object', operation: 'PUBLISH' },
        }),
      ).toBe(false);
    });

    test('returns false when operation is missing', () => {
      expect(
        matcher.canHandleEvent({
          info: { channel: { path: '/default/ch' }, channelNamespace: { name: 'default' } },
        }),
      ).toBe(false);
    });

    test('returns false when operation is not a string', () => {
      expect(
        matcher.canHandleEvent({
          info: { channel: { path: '/default/ch' }, channelNamespace: { name: 'default' }, operation: 123 },
        }),
      ).toBe(false);
    });
  });

  suite('defineEventsRoute', () => {
    test('preserves filters and handler', () => {
      const handler = vi.fn();
      const definition = defineEventsRoute({
        filters: { operation: 'PUBLISH', channelPath: '/default/*' },
      }).handle(handler);

      expect(definition.filters).toEqual({ operation: 'PUBLISH', channelPath: '/default/*' });
      expect(definition.handler).toBe(handler);
    });

    test('defaults filters to empty object when omitted', () => {
      const handler = vi.fn();
      const definition = defineEventsRoute({}).handle(handler);

      expect(definition.filters).toEqual({});
      expect(definition.handler).toBe(handler);
    });
  });

  suite('route', () => {
    test('returns this for chaining', () => {
      const result = matcher.route({
        filters: { operation: 'PUBLISH' },
        handler: vi.fn(),
      });

      expect(result).toBe(matcher);
    });
  });

  suite('publish', () => {
    test('returns this for chaining', () => {
      const result = matcher.publish({
        channelPath: '/default/*',
        handler: vi.fn(),
      });

      expect(result).toBe(matcher);
    });
  });

  suite('subscribe', () => {
    test('returns this for chaining', () => {
      const result = matcher.subscribe({
        channelPath: '/default/*',
        handler: vi.fn(),
      });

      expect(result).toBe(matcher);
    });
  });

  suite('matchRoute', () => {
    test('matches by operation', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { operation: 'PUBLISH' }, handler });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
      expect(matched?.handler).toBe(handler);
    });

    test('matches by operation array', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { operation: ['PUBLISH', 'SUBSCRIBE'] }, handler });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
      expect(matched?.handler).toBe(handler);
    });

    test('does not match when operation is different', async () => {
      matcher.route({ filters: { operation: 'PUBLISH' }, handler: vi.fn() });

      const event = createAppSyncEventsEvent({ info: { operation: 'SUBSCRIBE' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('SUBSCRIBE', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('matches channelPath with exact path', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { channelPath: '/default/channel' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelPath with wildcard /*', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { channelPath: '/*' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when channelPath is an empty string', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { channelPath: '' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('matches channelPath with prefix wildcard /foo/*', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { channelPath: '/default/*' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelPath with /namespace wildcard', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { channelPath: '/default*' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelPath array', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { channelPath: ['/default*', '/fake*'] }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when channelPath does not match', async () => {
      matcher.route({ filters: { channelPath: '/other/*' }, handler: vi.fn() });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('matches channelNamespace by name', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { channelNamespace: 'default' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelNamespace with wildcard', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { channelNamespace: 'def*' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when channelNamespace name differs', async () => {
      matcher.route({ filters: { channelNamespace: 'other' }, handler: vi.fn() });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('does not match a channelNamespace filter written as a channel path', async () => {
      matcher.route({ filters: { channelNamespace: '/default/*' }, handler: vi.fn() });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('matches when channelPath and channelNamespace both pass', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { channelPath: '/default/*', channelNamespace: 'default' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when channelPath passes but channelNamespace does not', async () => {
      matcher.route({ filters: { channelPath: '/default/*', channelNamespace: 'other' }, handler: vi.fn() });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('matches when custom returns true', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { custom: () => true }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches when async custom returns true', async () => {
      const handler = vi.fn();
      matcher.route({
        filters: {
          custom: async (): Promise<boolean> => {
            await new Promise((r) => setTimeout(r, 1));
            return true;
          },
        },
        handler,
      });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when async custom resolves false', async () => {
      matcher.route({
        filters: {
          custom: async (): Promise<boolean> => {
            await new Promise((r) => setTimeout(r, 1));
            return false;
          },
        },
        handler: vi.fn(),
      });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('does not match when custom returns false', async () => {
      matcher.route({ filters: { custom: () => false }, handler: vi.fn() });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('first route wins when multiple match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      matcher.route({ filters: { operation: 'PUBLISH' }, handler: firstHandler });
      matcher.route({ filters: { operation: 'PUBLISH' }, handler: secondHandler });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched?.handler).toBe(firstHandler);
    });

    test('orders a narrower route ahead of a broader one registered first', async () => {
      const broad = vi.fn();
      const narrow = vi.fn();
      matcher.route({ filters: { operation: 'PUBLISH' }, handler: broad });
      matcher.route({ filters: { operation: 'PUBLISH', channelNamespace: 'default' }, handler: narrow });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);

      expect(matched?.handler).toBe(narrow);
    });

    test('orders a guarded route ahead of the fallback it shares filters with', async () => {
      const fallback = vi.fn();
      const guarded = vi.fn();
      matcher.route({ filters: { operation: 'PUBLISH' }, handler: fallback });
      matcher.route({ filters: { operation: 'PUBLISH', custom: () => true }, handler: guarded });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);

      expect(matched?.handler).toBe(guarded);
    });

    test('matches when combined filters and custom all pass', async () => {
      const handler = vi.fn();
      matcher.route({
        filters: {
          operation: 'PUBLISH',
          channelPath: '/default/*',
          custom: () => true,
        },
        handler,
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when combined filters pass but custom fails', async () => {
      matcher.route({
        filters: {
          operation: 'PUBLISH',
          channelPath: '/default/*',
          custom: () => false,
        },
        handler: vi.fn(),
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });
  });

  suite('handleEvent', () => {
    test('builds complete AppSyncEventsRequest and calls handler', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });

      matcher.route({
        filters: { operation: 'PUBLISH' },
        handler,
      });

      const event = createAppSyncEventsEvent({
        info: {
          operation: 'PUBLISH',
          channel: { path: '/chat/room1', segments: ['chat', 'room1'] },
          channelNamespace: { name: 'chat' },
        },
        events: [{ id: 'e-1', payload: { message: 'hello' } }],
        request: { headers: { authorization: 'Bearer token' } },
      });
      const context = createMockContext();

      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ success: true });
      expect(handler).toHaveBeenCalledOnce();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          channelPath: '/chat/room1',
          channelNamespace: 'chat',
          operation: 'PUBLISH',
          identity: null,
          events: [{ id: 'e-1', payload: { message: 'hello' } }],
          info: event.info,
          request: event.request,
          stash: {},
          prev: null,
          event,
          context,
        }),
      );
    });

    test('throws when no route matches', async () => {
      const event = createAppSyncEventsEvent({
        info: { operation: 'PUBLISH', channel: { path: '/unknown/channel' } },
      });
      const context = createMockContext();

      await expect(matcher.handleEvent(event, context)).rejects.toThrow(
        'No route matched for PUBLISH on channel /unknown/channel',
      );
    });

    test('defaults null events to empty array', async () => {
      const handler = vi.fn().mockResolvedValue(null);

      matcher.route({ filters: {}, handler });

      const event = createAppSyncEventsEvent({ events: null });
      const context = createMockContext();

      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ events: [] }));
    });
  });

  suite('custom via shorthand methods', () => {
    test('publish passes custom to route filters', async () => {
      const custom = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');

      matcher.publish({
        channelPath: '/default/*',
        filters: { custom },
        handler,
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });
      const context = createMockContext();

      await matcher.handleEvent(event, context);

      expect(custom).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('publish rejects when custom returns false', async () => {
      const custom = vi.fn().mockReturnValue(false);

      matcher.publish({
        channelPath: '/default/*',
        filters: { custom },
        handler: vi.fn(),
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });
      const context = createMockContext();

      await expect(matcher.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('subscribe passes custom to route filters', async () => {
      const custom = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');

      matcher.subscribe({
        channelPath: '/default/*',
        filters: { custom },
        handler,
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'SUBSCRIBE' } });
      const context = createMockContext();

      await matcher.handleEvent(event, context);

      expect(custom).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('subscribe rejects when custom returns false', async () => {
      const custom = vi.fn().mockReturnValue(false);

      matcher.subscribe({
        channelPath: '/default/*',
        filters: { custom },
        handler: vi.fn(),
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'SUBSCRIBE' } });
      const context = createMockContext();

      await expect(matcher.handleEvent(event, context)).rejects.toThrow('No route matched');
    });
  });

  suite('handleEvent via shorthand methods', () => {
    test('routes PUBLISH events through publish()', async () => {
      const handler = vi.fn().mockResolvedValue('publish-result');

      matcher.publish({ channelPath: '/default/*', handler });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });
      const context = createMockContext();

      const result = await matcher.handleEvent(event, context);
      expect(result).toBe('publish-result');
    });

    test('routes SUBSCRIBE events through subscribe()', async () => {
      const handler = vi.fn().mockResolvedValue('subscribe-result');

      matcher.subscribe({ channelPath: '/default/*', handler });

      const event = createAppSyncEventsEvent({ info: { operation: 'SUBSCRIBE' } });
      const context = createMockContext();

      const result = await matcher.handleEvent(event, context);
      expect(result).toBe('subscribe-result');
    });
  });

  suite('matcher-level middleware', () => {
    test('executes middleware before the route handler', async () => {
      const callOrder: string[] = [];

      async function middleware(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      }

      const matcher = createAppSyncEventsMatcher({ middleware: [middleware] });
      matcher.route(
        defineEventsRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
          return 'result';
        }),
      );

      await matcher.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to short-circuit with an early return', async () => {
      const handler = vi.fn().mockResolvedValue('result');

      async function blockingMiddleware(_request: AppSyncEventsRequest, _next: EventsNext): Promise<unknown> {
        return { error: 'Unauthorized' };
      }

      const matcher = createAppSyncEventsMatcher({ middleware: [blockingMiddleware] });
      matcher.route(defineEventsRoute({ filters: {} }).handle(handler));

      const result = await matcher.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(result).toEqual({ error: 'Unauthorized' });
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple matcher-level middleware in order', async () => {
      const callOrder: string[] = [];

      async function middlewareOne(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        callOrder.push('mw1-pre');
        const result = await next(request);
        callOrder.push('mw1-post');
        return result;
      }

      async function middlewareTwo(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        callOrder.push('mw2-pre');
        const result = await next(request);
        callOrder.push('mw2-post');
        return result;
      }

      const matcher = createAppSyncEventsMatcher({ middleware: [middlewareOne, middlewareTwo] });
      matcher.route(
        defineEventsRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
          return 'result';
        }),
      );

      await matcher.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(callOrder).toEqual(['mw1-pre', 'mw2-pre', 'handler', 'mw2-post', 'mw1-post']);
    });

    test('allows middleware to modify the result', async () => {
      async function middleware(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        const result = await next(request);
        return { ...(result as Record<string, unknown>), cached: true };
      }

      const matcher = createAppSyncEventsMatcher({ middleware: [middleware] });
      matcher.route(defineEventsRoute({ filters: {} }).handle(async () => ({ id: '1' })));

      const result = await matcher.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(result).toEqual({ id: '1', cached: true });
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware via publish convenience method', async () => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        callOrder.push('route-mw');
        return next(request);
      }

      matcher.publish({
        channelPath: '/default/*',
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return 'result';
        },
      });

      await matcher.handleEvent(createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } }), createMockContext());

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn().mockResolvedValue('result');

      async function blockingRouteMiddleware(_request: AppSyncEventsRequest, _next: EventsNext): Promise<unknown> {
        return { error: 'blocked' };
      }

      matcher.route(defineEventsRoute({ filters: {}, middleware: [blockingRouteMiddleware] }).handle(handler));

      const result = await matcher.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(result).toEqual({ error: 'blocked' });
      expect(handler).not.toHaveBeenCalled();
    });

    test('supports middleware on defineEventsRoute builder pattern', async () => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        callOrder.push('route-mw');
        return next(request);
      }

      matcher.route(
        defineEventsRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
          return 'result';
        }),
      );

      await matcher.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined matcher and route middleware', () => {
    test('executes matcher middleware before route middleware', async () => {
      const callOrder: string[] = [];

      async function matcherMiddleware(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        callOrder.push('matcher-mw');
        return next(request);
      }

      async function routeMiddleware(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        callOrder.push('route-mw');
        return next(request);
      }

      const matcher = createAppSyncEventsMatcher({ middleware: [matcherMiddleware] });
      matcher.route(
        defineEventsRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
          return 'result';
        }),
      );

      await matcher.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });
  });
});

suite('published events', () => {
  test('types each entry as an id and a payload', async () => {
    const handler = vi.fn().mockResolvedValue({ events: [] });
    matcher.publish({ channelPath: '/orders/*', handler });

    const event = createAppSyncEventsEvent({
      info: { channel: { path: '/orders/new', segments: ['orders', 'new'] } },
      events: [{ id: 'e-1', payload: { orderId: 'o-1' } }],
    });
    await matcher.handleEvent(event, createMockContext());

    const [{ events }] = handler.mock.calls[0] as [AppSyncEventsRequest];
    const ids: string[] = events.map(({ id }) => id);

    expect(ids).toEqual(['e-1']);
  });

  test('carries a payload that is not an object', async () => {
    const handler = vi.fn().mockResolvedValue({ events: [] });
    matcher.publish({ channelPath: '/orders/*', handler });

    const event = createAppSyncEventsEvent({
      info: { channel: { path: '/orders/new', segments: ['orders', 'new'] } },
      events: [{ id: 'e-1', payload: 42 }],
    });
    await matcher.handleEvent(event, createMockContext());

    const [{ events }] = handler.mock.calls[0] as [AppSyncEventsRequest];

    expect(events[0]?.payload).toBe(42);
  });
});

suite('payloadSchema', () => {
  test('hands the handler the schema output', async () => {
    const payloadSchema = createMockSchema({ value: { orderId: 'o-1', total: 42 } });
    const handler = vi.fn().mockResolvedValue({ events: [] });
    matcher.route(defineEventsRoute({ filters: { operation: 'PUBLISH' }, payloadSchema }).handle(handler));

    const event = createAppSyncEventsEvent({ events: [{ id: 'e-1', payload: { orderId: 'o-1' } }] });
    await matcher.handleEvent(event, createMockContext());

    const [{ events }] = handler.mock.calls[0] as [AppSyncEventsRequest];

    expect(events[0]?.payload).toEqual({ orderId: 'o-1', total: 42 });
  });

  test('throws when a payload fails its schema', async () => {
    const payloadSchema = createMockSchema({ issues: [{ message: 'orderId is required' }] });
    matcher.route(defineEventsRoute({ filters: { operation: 'PUBLISH' }, payloadSchema }).handle(vi.fn()));

    const event = createAppSyncEventsEvent({ events: [{ id: 'e-1', payload: {} }] });

    await expect(matcher.handleEvent(event, createMockContext())).rejects.toThrow(
      'Payload validation failed for event e-1',
    );
  });

  test('leaves the payload alone when no schema is given', async () => {
    const handler = vi.fn().mockResolvedValue({ events: [] });
    matcher.route(defineEventsRoute({ filters: { operation: 'PUBLISH' } }).handle(handler));

    const event = createAppSyncEventsEvent({ events: [{ id: 'e-1', payload: { untouched: true } }] });
    await matcher.handleEvent(event, createMockContext());

    const [{ events }] = handler.mock.calls[0] as [AppSyncEventsRequest];

    expect(events[0]?.payload).toEqual({ untouched: true });
  });
});

suite('result types', () => {
  test('an outgoing entry carries a payload or an error', () => {
    const broadcast: AppSyncEventsOutgoingEvent = { id: 'e-1', payload: { ok: true } };
    const refused: AppSyncEventsOutgoingEvent = { id: 'e-2', error: 'no body' };

    expect([broadcast, refused]).toHaveLength(2);
  });

  test('rejects an entry carrying both, because AWS drops the payload', () => {
    // @ts-expect-error AWS discards the payload when an entry also carries an error
    const entry: AppSyncEventsOutgoingEvent = { id: 'e-1', payload: { ok: true }, error: 'no body' };

    expect(entry.id).toBe('e-1');
  });

  test('rejects an entry with neither, because AWS answers 502', () => {
    // @ts-expect-error an entry needs a payload or an error
    const entry: AppSyncEventsOutgoingEvent = { id: 'e-1' };

    expect(entry.id).toBe('e-1');
  });

  test('a publish result carries events or a top level error', () => {
    const broadcast: AppSyncEventsPublishResult = { events: [{ id: 'e-1', payload: null }] };
    const refused: AppSyncEventsPublishResult = { error: 'the whole publish failed' };

    expect([broadcast, refused]).toHaveLength(2);
  });

  test('rejects an empty publish result, because AWS answers 502', () => {
    // @ts-expect-error a publish result needs events or an error
    const result: AppSyncEventsPublishResult = {};

    expect(result).toEqual({});
  });

  test('a subscribe result is null or an error', () => {
    const admitted: AppSyncEventsSubscribeResult = null;
    const refused: AppSyncEventsSubscribeResult = { error: 'not allowed' };

    expect([admitted, refused]).toHaveLength(2);
  });
});

suite('AppSyncEventsMatcher.canHandleEvent', () => {
  const ownEvents = ['createAppSyncEventsEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createAppSyncEventsMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
