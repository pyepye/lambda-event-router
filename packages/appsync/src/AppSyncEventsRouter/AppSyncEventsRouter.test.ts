import { createAppSyncEventsEvent, createMockContext, test } from '@lambda-event-router/testing';
import { AppSyncEventsRouter, createAppSyncEventsRouter, defineEventsRoute } from './AppSyncEventsRouter.js';

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
        filters: { operation: 'PUBLISH', channelNamespace: '/default/*' },
      }).handle(handler);

      expect(definition.filters).toEqual({ operation: 'PUBLISH', channelNamespace: '/default/*' });
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
        channelNamespace: '/default/*',
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('subscribe', () => {
    test('returns this for chaining', () => {
      const result = router.subscribe({
        channelNamespace: '/default/*',
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

    test('matches channelNamespace with exact path', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelNamespace: '/default/channel' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelNamespace with wildcard /*', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelNamespace: '/*' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelNamespace with prefix wildcard /foo/*', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelNamespace: '/default/*' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelNamespace by namespace name', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelNamespace: 'default' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelNamespace with /namespace shorthand', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelNamespace: '/default' }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches channelNamespace array', async () => {
      const handler = vi.fn();
      router.route({ filters: { channelNamespace: ['/default', '/fake'] }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when channelNamespace does not match', async () => {
      router.route({ filters: { channelNamespace: '/other/*' }, handler: vi.fn() });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeUndefined();
    });

    test('matches when customFilter returns true', async () => {
      const handler = vi.fn();
      router.route({ filters: { customFilter: () => true }, handler });

      const event = createAppSyncEventsEvent();

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('matches when async customFilter returns true', async () => {
      const handler = vi.fn();
      router.route({
        filters: {
          customFilter: async (): Promise<boolean> => {
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

    test('does not match when customFilter returns false', async () => {
      router.route({ filters: { customFilter: () => false }, handler: vi.fn() });

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

    test('matches when combined filters and customFilter all pass', async () => {
      const handler = vi.fn();
      router.route({
        filters: {
          operation: 'PUBLISH',
          channelNamespace: '/default/*',
          customFilter: () => true,
        },
        handler,
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute('PUBLISH', '/default/channel', 'default', event);
      expect(matched).toBeDefined();
    });

    test('does not match when combined filters pass but customFilter fails', async () => {
      router.route({
        filters: {
          operation: 'PUBLISH',
          channelNamespace: '/default/',
          customFilter: () => false,
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
          channel: '/chat/room1',
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

  suite('customFilter via shorthand methods', () => {
    test('publish passes customFilter to route filters', async () => {
      const customFilter = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');

      router.publish({
        channelNamespace: '/default/*',
        filters: { customFilter },
        handler,
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });
      const context = createMockContext();

      await router.handleEvent(event, context);

      expect(customFilter).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('publish rejects when customFilter returns false', async () => {
      const customFilter = vi.fn().mockReturnValue(false);

      router.publish({
        channelNamespace: '/default/*',
        filters: { customFilter },
        handler: vi.fn(),
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });
      const context = createMockContext();

      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('subscribe passes customFilter to route filters', async () => {
      const customFilter = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');

      router.subscribe({
        channelNamespace: '/default/*',
        filters: { customFilter },
        handler,
      });

      const event = createAppSyncEventsEvent({ info: { operation: 'SUBSCRIBE' } });
      const context = createMockContext();

      await router.handleEvent(event, context);

      expect(customFilter).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('subscribe rejects when customFilter returns false', async () => {
      const customFilter = vi.fn().mockReturnValue(false);

      router.subscribe({
        channelNamespace: '/default/*',
        filters: { customFilter },
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

      router.publish({ channelNamespace: '/default/*', handler });

      const event = createAppSyncEventsEvent({ info: { operation: 'PUBLISH' } });
      const context = createMockContext();

      const result = await router.handleEvent(event, context);
      expect(result).toBe('publish-result');
    });

    test('routes SUBSCRIBE events through subscribe()', async () => {
      const handler = vi.fn().mockResolvedValue('subscribe-result');

      router.subscribe({ channelNamespace: '/default/*', handler });

      const event = createAppSyncEventsEvent({ info: { operation: 'SUBSCRIBE' } });
      const context = createMockContext();

      const result = await router.handleEvent(event, context);
      expect(result).toBe('subscribe-result');
    });
  });
});
