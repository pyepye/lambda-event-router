import { createAppSyncEventsEvent, createMockContext, test } from '@lambda-event-router/testing';

import { AppSyncEventsRouter, createAppSyncEventsRouter, defineEventsRoute } from './AppSyncEventsRouter.js';
import type { AppSyncEventsRequest } from './types.js';

type EventsNext = (request: AppSyncEventsRequest) => Promise<unknown>;

let router: AppSyncEventsRouter;

beforeEach(() => {
  router = new AppSyncEventsRouter();
});

suite('AppSyncEventsRouter', () => {
  suite('createAppSyncEventsRouter', () => {
    test('creates an AppSyncEventsRouter instance', () => {
      const router = createAppSyncEventsRouter();
      expect(router).toBeInstanceOf(AppSyncEventsRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid AppSync events event', () => {
      const event = createAppSyncEventsEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when info is missing', () => {
      expect(router.canHandleEvent({ events: [] })).toBe(false);
    });

    test('returns false when info is not an object', () => {
      expect(router.canHandleEvent({ info: 'not-an-object' })).toBe(false);
    });

    test('returns false when channel is missing', () => {
      expect(
        router.canHandleEvent({
          info: { channelNamespace: { name: 'default' }, operation: 'PUBLISH' },
        }),
      ).toBe(false);
    });

    test('returns false when channel is not an object', () => {
      expect(
        router.canHandleEvent({
          info: { channel: 'not-object', channelNamespace: { name: 'default' }, operation: 'PUBLISH' },
        }),
      ).toBe(false);
    });

    test('returns false when channelNamespace is missing', () => {
      expect(
        router.canHandleEvent({
          info: { channel: { path: '/default/ch' }, operation: 'PUBLISH' },
        }),
      ).toBe(false);
    });

    test('returns false when channelNamespace is not an object', () => {
      expect(
        router.canHandleEvent({
          info: { channel: { path: '/default/ch' }, channelNamespace: 'not-object', operation: 'PUBLISH' },
        }),
      ).toBe(false);
    });

    test('returns false when operation is missing', () => {
      expect(
        router.canHandleEvent({
          info: { channel: { path: '/default/ch' }, channelNamespace: { name: 'default' } },
        }),
      ).toBe(false);
    });

    test('returns false when operation is not a string', () => {
      expect(
        router.canHandleEvent({
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
      const result = router.route({
        filters: { operation: 'PUBLISH' },
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('publish', () => {
    test('returns this for chaining', () => {
      const result = router.publish({
        channelPath: '/default/*',
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('subscribe', () => {
    test('returns this for chaining', () => {
      const result = router.subscribe({
        channelPath: '/default/*',
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches by operation', async () => {
      const handler = vi.fn();
      router.route({ filters: { operation: 'PUBLISH' }, handler });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
      expect(matched?.handler).toBe(handler);
    });

    test('matches by operation array', async () => {
      const handler = vi.fn();
      router.route({ filters: { operation: ['PUBLISH', 'SUBSCRIBE'] }, handler });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
      expect(matched?.handler).toBe(handler);
    });

    test('does not match when operation is different', async () => {
      router.route({ filters: { operation: 'PUBLISH' }, handler: vi.fn() });

      const event = createAppSyncEventsEvent({ info: { operation: 'SUBSCRIBE' } });

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('SUBSCRIBE', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('matches channelPath with exact path', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelPath: '/default/channel' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelPath with wildcard /*', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelPath: '/*' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelPath with prefix wildcard /foo/*', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelPath: '/default/*' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelPath with /namespace wildcard', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelPath: '/default*' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelPath array', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelPath: ['/default*', '/fake*'] }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when channelPath does not match', async () => {
      router.route({ filters: { channelPath: '/other/*' }, handler: vi.fn() });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('matches channelNamespace by name', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelNamespace: 'default' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelNamespace with wildcard', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelNamespace: 'def*' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when channelNamespace name differs', async () => {
      router.route({ filters: { channelNamespace: 'other' }, handler: vi.fn() });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('does not match a channelNamespace filter written as a channel path', async () => {
      router.route({ filters: { channelNamespace: '/default/*' }, handler: vi.fn() });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('matches when channelPath and channelNamespace both pass', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelPath: '/default/*', channelNamespace: 'default' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when channelPath passes but channelNamespace does not', async () => {
      router.route({ filters: { channelPath: '/default/*', channelNamespace: 'other' }, handler: vi.fn() });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('matches when custom returns true', async () => {
      const handler = vi.fn();
      router.route({ filters: { custom: () => true }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches when async custom returns true', async () => {
      const handler = vi.fn();
      router.route({
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
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when async custom resolves false', async () => {
      router.route({
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
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('does not match when custom returns false', async () => {
      router.route({ filters: { custom: () => false }, handler: vi.fn() });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('first route wins when multiple match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route({ filters: { operation: 'PUBLISH' }, handler: firstHandler });
      router.route({ filters: { operation: 'PUBLISH' }, handler: secondHandler });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched?.handler).toBe(firstHandler);
    });

    test('matches when combined filters and custom all pass', async () => {
      const handler = vi.fn();
      router.route({
        filters: {
          operation: 'PUBLISH',
          channelPath: '/default/*',
          custom: () => true,
        },
        handler,
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when combined filters pass but custom fails', async () => {
      router.route({
        filters: {
          operation: 'PUBLISH',
          channelPath: '/default/*',
          custom: () => false,
        },
        handler: vi.fn(),
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });
  });

  suite('handleEvent', () => {
    test('builds complete AppSyncEventsRequest and calls handler', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });

      router.route({
        filters: { operation: 'PUBLISH' },
        handler,
      });

      const event = createAppSyncEventsEvent({
        info: {
          operation: 'PUBLISH',
          channel: { path: '/chat/room1', segments: ['chat', 'room1'] },
          channelNamespace: { name: 'chat' },
        },
        events: [{ message: 'hello' }],
        request: { headers: { authorization: 'Bearer token' } },
      });
      const context = createMockContext();

      const result = await router.handleEvent(event, context);

      expect(result).toEqual({ success: true });
      expect(handler).toHaveBeenCalledOnce();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          channelPath: '/chat/room1',
          channelNamespace: 'chat',
          operation: 'PUBLISH',
          identity: null,
          events: [{ message: 'hello' }],
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

      await expect(router.handleEvent(event, context)).rejects.toThrow(
        'No route matched for PUBLISH on channel /unknown/channel',
      );
    });

    test('defaults null events to empty array', async () => {
      const handler = vi.fn().mockResolvedValue(null);

      router.route({ filters: {}, handler });

      const event = createAppSyncEventsEvent({ events: null });
      const context = createMockContext();

      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ events: [] }));
    });
  });

  suite('custom via shorthand methods', () => {
    test('publish passes custom to route filters', async () => {
      const custom = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');

      router.publish({
        channelPath: '/default/*',
        filters: { custom },
        handler,
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });
      const context = createMockContext();

      await router.handleEvent(event, context);

      expect(custom).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('publish rejects when custom returns false', async () => {
      const custom = vi.fn().mockReturnValue(false);

      router.publish({
        channelPath: '/default/*',
        filters: { custom },
        handler: vi.fn(),
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });
      const context = createMockContext();

      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('subscribe passes custom to route filters', async () => {
      const custom = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');

      router.subscribe({
        channelPath: '/default/*',
        filters: { custom },
        handler,
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'SUBSCRIBE' } });
      const context = createMockContext();

      await router.handleEvent(event, context);

      expect(custom).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('subscribe rejects when custom returns false', async () => {
      const custom = vi.fn().mockReturnValue(false);

      router.subscribe({
        channelPath: '/default/*',
        filters: { custom },
        handler: vi.fn(),
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'SUBSCRIBE' } });
      const context = createMockContext();

      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });
  });

  suite('handleEvent via shorthand methods', () => {
    test('routes PUBLISH events through publish()', async () => {
      const handler = vi.fn().mockResolvedValue('publish-result');

      router.publish({ channelPath: '/default/*', handler });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });
      const context = createMockContext();

      const result = await router.handleEvent(event, context);
      expect(result).toBe('publish-result');
    });

    test('routes SUBSCRIBE events through subscribe()', async () => {
      const handler = vi.fn().mockResolvedValue('subscribe-result');

      router.subscribe({ channelPath: '/default/*', handler });

      const event = createAppSyncEventsEvent({ info: { operation: 'SUBSCRIBE' } });
      const context = createMockContext();

      const result = await router.handleEvent(event, context);
      expect(result).toBe('subscribe-result');
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async () => {
      const callOrder: string[] = [];

      async function middleware(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      }

      const router = createAppSyncEventsRouter({ middleware: [middleware] });
      router.route(
        defineEventsRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
          return 'result';
        }),
      );

      await router.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to short-circuit with an early return', async () => {
      const handler = vi.fn().mockResolvedValue('result');

      async function blockingMiddleware(_request: AppSyncEventsRequest, _next: EventsNext): Promise<unknown> {
        return { error: 'Unauthorized' };
      }

      const router = createAppSyncEventsRouter({ middleware: [blockingMiddleware] });
      router.route(defineEventsRoute({ filters: {} }).handle(handler));

      const result = await router.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(result).toEqual({ error: 'Unauthorized' });
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async () => {
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

      const router = createAppSyncEventsRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route(
        defineEventsRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
          return 'result';
        }),
      );

      await router.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(callOrder).toEqual(['mw1-pre', 'mw2-pre', 'handler', 'mw2-post', 'mw1-post']);
    });

    test('allows middleware to modify the result', async () => {
      async function middleware(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        const result = await next(request);
        return { ...(result as Record<string, unknown>), cached: true };
      }

      const router = createAppSyncEventsRouter({ middleware: [middleware] });
      router.route(defineEventsRoute({ filters: {} }).handle(async () => ({ id: '1' })));

      const result = await router.handleEvent(createAppSyncEventsEvent(), createMockContext());

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

      router.publish({
        channelPath: '/default/*',
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return 'result';
        },
      });

      await router.handleEvent(createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } }), createMockContext());

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn().mockResolvedValue('result');

      async function blockingRouteMiddleware(_request: AppSyncEventsRequest, _next: EventsNext): Promise<unknown> {
        return { error: 'blocked' };
      }

      router.route(defineEventsRoute({ filters: {}, middleware: [blockingRouteMiddleware] }).handle(handler));

      const result = await router.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(result).toEqual({ error: 'blocked' });
      expect(handler).not.toHaveBeenCalled();
    });

    test('supports middleware on defineEventsRoute builder pattern', async () => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        callOrder.push('route-mw');
        return next(request);
      }

      router.route(
        defineEventsRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
          return 'result';
        }),
      );

      await router.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async () => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        callOrder.push('router-mw');
        return next(request);
      }

      async function routeMiddleware(request: AppSyncEventsRequest, next: EventsNext): Promise<unknown> {
        callOrder.push('route-mw');
        return next(request);
      }

      const router = createAppSyncEventsRouter({ middleware: [routerMiddleware] });
      router.route(
        defineEventsRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
          return 'result';
        }),
      );

      await router.handleEvent(createAppSyncEventsEvent(), createMockContext());

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });
  });
});
