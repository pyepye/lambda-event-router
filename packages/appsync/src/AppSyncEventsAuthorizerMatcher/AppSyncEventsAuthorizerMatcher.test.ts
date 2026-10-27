import { allEventBuilders, createAppSyncEventsAuthorizerEvent, createMockContext, test } from '@latcher/testing';

import {
  AppSyncEventsAuthorizerMatcher,
  createAppSyncEventsAuthorizerMatcher,
  defineEventsAuthorizerRoute,
} from './AppSyncEventsAuthorizerMatcher.js';
import { EventsAuthorized, EventsDenied, isAppSyncEventsAuthorizerResponse } from './response.js';
import type {
  AppSyncEventsAuthorizerEvent,
  AppSyncEventsAuthorizerRequest,
  AppSyncEventsAuthorizerResponse,
} from './types.js';

type AuthorizerNext = (request: AppSyncEventsAuthorizerRequest) => Promise<AppSyncEventsAuthorizerResponse>;

const connectEvent: AppSyncEventsAuthorizerEvent = createAppSyncEventsAuthorizerEvent({
  requestContext: { operation: 'EVENT_CONNECT', channel: undefined, channelNamespaceName: undefined },
});

suite('AppSyncEventsAuthorizerMatcher', () => {
  let matcher: AppSyncEventsAuthorizerMatcher;

  beforeEach(() => {
    matcher = new AppSyncEventsAuthorizerMatcher();
  });

  suite('createAppSyncEventsAuthorizerMatcher', () => {
    test('creates an AppSyncEventsAuthorizerMatcher instance', () => {
      expect(createAppSyncEventsAuthorizerMatcher()).toBeInstanceOf(AppSyncEventsAuthorizerMatcher);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a publish authorizer event', () => {
      expect(matcher.canHandleEvent(createAppSyncEventsAuthorizerEvent())).toBe(true);
    });

    test('returns true for a connect authorizer event with no channel', () => {
      expect(matcher.canHandleEvent(connectEvent)).toBe(true);
    });

    test('returns false for a GraphQL authorizer event', () => {
      const graphqlEvent = {
        authorizationToken: 'token',
        requestHeaders: {},
        requestContext: {
          apiId: 'api',
          accountId: '123456789012',
          requestId: 'req',
          queryString: 'query { getUser { id } }',
          variables: {},
        },
      };
      expect(matcher.canHandleEvent(graphqlEvent)).toBe(false);
    });

    test('returns false when the operation is not an Event API operation', () => {
      const event = createAppSyncEventsAuthorizerEvent();
      expect(
        matcher.canHandleEvent({ ...event, requestContext: { ...event.requestContext, operation: 'PUBLISH' } }),
      ).toBe(false);
    });

    test('returns false when the channel is not a string', () => {
      const event = createAppSyncEventsAuthorizerEvent();
      expect(matcher.canHandleEvent({ ...event, requestContext: { ...event.requestContext, channel: 42 } })).toBe(
        false,
      );
    });

    test('returns false for null', () => {
      expect(matcher.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(matcher.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when the authorization token is missing', () => {
      const event = createAppSyncEventsAuthorizerEvent();
      expect(matcher.canHandleEvent({ ...event, authorizationToken: undefined })).toBe(false);
    });

    test('returns false when the request context is not an object', () => {
      const event = createAppSyncEventsAuthorizerEvent();
      expect(matcher.canHandleEvent({ ...event, requestContext: 'nope' })).toBe(false);
    });

    test('returns false when the api id is not a string', () => {
      const event = createAppSyncEventsAuthorizerEvent();
      expect(matcher.canHandleEvent({ ...event, requestContext: { ...event.requestContext, apiId: 42 } })).toBe(false);
    });

    test('returns false when the account id is not a string', () => {
      const event = createAppSyncEventsAuthorizerEvent();
      expect(matcher.canHandleEvent({ ...event, requestContext: { ...event.requestContext, accountId: 42 } })).toBe(
        false,
      );
    });

    test('returns false when the channel namespace is not a string', () => {
      const event = createAppSyncEventsAuthorizerEvent();
      expect(
        matcher.canHandleEvent({ ...event, requestContext: { ...event.requestContext, channelNamespaceName: 42 } }),
      ).toBe(false);
    });
  });

  suite('routing', () => {
    test('sends a publish to the publish route', async () => {
      const subscribeHandler = vi.fn();
      matcher.subscribe({ channelPath: '/default/*', handler: subscribeHandler }).publish({
        channelPath: '/default/*',
        handler: async () => EventsAuthorized({ handlerContext: { via: 'publish' } }),
      });

      const result = await matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext());

      expect(result).toEqual({ isAuthorized: true, handlerContext: { via: 'publish' } });
      expect(subscribeHandler).not.toHaveBeenCalled();
    });

    test('sends a connect to the connect route, which no channel filter can match', async () => {
      matcher
        .publish({
          channelPath: '/default/*',
          handler: async () => EventsAuthorized({ handlerContext: { via: 'publish' } }),
        })
        .connect({ handler: async () => EventsAuthorized({ handlerContext: { via: 'connect' } }) });

      const result = await matcher.handleEvent(connectEvent, createMockContext());

      expect(result).toEqual({ isAuthorized: true, handlerContext: { via: 'connect' } });
    });

    test('matches on the channel namespace', async () => {
      matcher.route(
        defineEventsAuthorizerRoute({ filters: { channelNamespace: 'default' } }).handle(async () =>
          EventsAuthorized({ handlerContext: { via: 'namespace' } }),
        ),
      );

      const result = await matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext());

      expect(result).toEqual({ isAuthorized: true, handlerContext: { via: 'namespace' } });
    });

    test('orders an exact channel path ahead of the wildcard that covers it', async () => {
      const wildcard = vi.fn();
      matcher
        .route(defineEventsAuthorizerRoute({ filters: { channelPath: '/default/*' } }).handle(wildcard))
        .route(
          defineEventsAuthorizerRoute({ filters: { channelPath: '/default/channel' } }).handle(async () =>
            EventsAuthorized({ handlerContext: { via: 'exact' } }),
          ),
        );

      const result = await matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext());

      expect(result).toEqual({ isAuthorized: true, handlerContext: { via: 'exact' } });
      expect(wildcard).not.toHaveBeenCalled();
    });

    test('orders a guarded route ahead of the fallback it shares filters with', async () => {
      const fallback = vi.fn();
      matcher
        .route(defineEventsAuthorizerRoute({ filters: { channelNamespace: 'default' } }).handle(fallback))
        .route(
          defineEventsAuthorizerRoute({ filters: { channelNamespace: 'default', custom: () => true } }).handle(
            async () => EventsAuthorized({ handlerContext: { via: 'guarded' } }),
          ),
        );

      const result = await matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext());

      expect(result).toEqual({ isAuthorized: true, handlerContext: { via: 'guarded' } });
      expect(fallback).not.toHaveBeenCalled();
    });

    test('takes a list of operations on one route', async () => {
      matcher.route(
        defineEventsAuthorizerRoute({ filters: { operation: ['EVENT_CONNECT', 'EVENT_PUBLISH'] } }).handle(async () =>
          EventsAuthorized(),
        ),
      );

      await expect(matcher.handleEvent(connectEvent, createMockContext())).resolves.toEqual({ isAuthorized: true });
      await expect(matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
    });

    test('asks the custom filter with the channel and operation', async () => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.route(defineEventsAuthorizerRoute({ filters: { custom } }).handle(async () => EventsAuthorized()));

      await matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext());

      expect(custom).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'EVENT_PUBLISH',
          channelPath: '/default/channel',
          channelNamespace: 'default',
        }),
      );
    });

    test('throws when no route matches', async () => {
      matcher.subscribe({ channelPath: '/other/*', handler: async () => EventsAuthorized() });

      await expect(matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext())).rejects.toThrow(
        'No authorizer route matched for EVENT_PUBLISH on channel /default/channel',
      );
    });

    test('does not match when the channelPath filter is an empty string', async () => {
      matcher.publish({ channelPath: '', handler: async () => EventsAuthorized() });

      await expect(matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext())).rejects.toThrow(
        'No authorizer route matched for EVENT_PUBLISH on channel /default/channel',
      );
    });

    test('names no channel in the error when a connect matches nothing', async () => {
      await expect(matcher.handleEvent(connectEvent, createMockContext())).rejects.toThrow(
        'No authorizer route matched for EVENT_CONNECT',
      );
    });
  });

  suite('request', () => {
    test('carries the channel and namespace for a publish', async () => {
      let seen: AppSyncEventsAuthorizerRequest | undefined;
      matcher.route({
        handler: async (request: AppSyncEventsAuthorizerRequest) => {
          seen = request;
          return EventsAuthorized();
        },
      });

      await matcher.handleEvent(createAppSyncEventsAuthorizerEvent({ authorizationToken: 'abc' }), createMockContext());

      expect(seen).toMatchObject({
        authorizationToken: 'abc',
        operation: 'EVENT_PUBLISH',
        channelPath: '/default/channel',
        channelNamespace: 'default',
        accountId: '123456789012',
      });
    });

    test('leaves the channel undefined for a connect', async () => {
      let seen: AppSyncEventsAuthorizerRequest | undefined;
      matcher.connect({
        handler: async (request: AppSyncEventsAuthorizerRequest) => {
          seen = request;
          return EventsAuthorized();
        },
      });

      await matcher.handleEvent(connectEvent, createMockContext());

      expect(seen?.channelPath).toBeUndefined();
      expect(seen?.channelNamespace).toBeUndefined();
    });
  });

  suite('middleware', () => {
    test('runs matcher middleware before route middleware', async () => {
      const callOrder: string[] = [];

      const matcherMiddleware = async (
        request: AppSyncEventsAuthorizerRequest,
        next: AuthorizerNext,
      ): Promise<AppSyncEventsAuthorizerResponse> => {
        callOrder.push('matcher-mw');
        return next(request);
      };

      const routeMiddleware = async (
        request: AppSyncEventsAuthorizerRequest,
        next: AuthorizerNext,
      ): Promise<AppSyncEventsAuthorizerResponse> => {
        callOrder.push('route-mw');
        return next(request);
      };

      const matcher = createAppSyncEventsAuthorizerMatcher({ middleware: [matcherMiddleware] });
      matcher.publish({
        channelPath: '/default/*',
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return EventsAuthorized();
        },
      });

      await matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext());

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });

    test('returns a response thrown from middleware', async () => {
      const denying = async (): Promise<AppSyncEventsAuthorizerResponse> => {
        throw EventsDenied({ ttlOverride: 0 });
      };

      const matcher = createAppSyncEventsAuthorizerMatcher({ middleware: [denying] });
      matcher.publish({ channelPath: '/default/*', handler: async () => EventsAuthorized() });

      await expect(matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: false,
        ttlOverride: 0,
      });
    });

    test('rethrows anything that is not a response', async () => {
      matcher.publish({
        channelPath: '/default/*',
        handler: async () => {
          throw new Error('Token store unreachable');
        },
      });

      await expect(matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext())).rejects.toThrow(
        'Token store unreachable',
      );
    });
  });

  suite('response helpers', () => {
    test('EventsAuthorized takes handler context and a ttl override', () => {
      expect(EventsAuthorized({ handlerContext: { role: 'agent' }, ttlOverride: 0 })).toEqual({
        isAuthorized: true,
        handlerContext: { role: 'agent' },
        ttlOverride: 0,
      });
    });

    test('EventsAuthorized on its own authorises with nothing attached', () => {
      expect(EventsAuthorized()).toEqual({ isAuthorized: true });
    });

    test('EventsDenied takes a ttl override', () => {
      expect(EventsDenied({ ttlOverride: 0 })).toEqual({ isAuthorized: false, ttlOverride: 0 });
    });

    test('EventsDenied on its own refuses', () => {
      expect(EventsDenied()).toEqual({ isAuthorized: false });
    });
  });

  suite('filter misses', () => {
    test('a channel path filter skips a connect, which names no channel', async () => {
      const channelHandler = vi.fn();
      matcher
        .route(defineEventsAuthorizerRoute({ filters: { channelPath: '/default/*' } }).handle(channelHandler))
        .connect({ handler: async () => EventsAuthorized({ handlerContext: { via: 'connect' } }) });

      const result = await matcher.handleEvent(connectEvent, createMockContext());

      expect(result).toEqual({ isAuthorized: true, handlerContext: { via: 'connect' } });
      expect(channelHandler).not.toHaveBeenCalled();
    });

    test('a channel namespace filter skips a connect', async () => {
      const namespaceHandler = vi.fn();
      matcher
        .route(defineEventsAuthorizerRoute({ filters: { channelNamespace: 'default' } }).handle(namespaceHandler))
        .connect({ handler: async () => EventsAuthorized() });

      await matcher.handleEvent(connectEvent, createMockContext());

      expect(namespaceHandler).not.toHaveBeenCalled();
    });

    test('skips a route whose channel path does not match', async () => {
      matcher
        .publish({
          channelPath: '/other/*',
          handler: async () => EventsAuthorized({ handlerContext: { via: 'other' } }),
        })
        .publish({
          channelPath: '/default/*',
          handler: async () => EventsAuthorized({ handlerContext: { via: 'default' } }),
        });

      const result = await matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext());

      expect(result).toEqual({ isAuthorized: true, handlerContext: { via: 'default' } });
    });

    test('skips a route whose channel namespace does not match', async () => {
      matcher
        .route(
          defineEventsAuthorizerRoute({ filters: { channelNamespace: 'other' } }).handle(async () => EventsDenied()),
        )
        .route(
          defineEventsAuthorizerRoute({ filters: { channelNamespace: 'default' } }).handle(async () =>
            EventsAuthorized(),
          ),
        );

      await expect(matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
    });

    test('skips a route whose operation does not match', async () => {
      matcher
        .subscribe({ channelPath: '/default/*', handler: async () => EventsDenied() })
        .publish({ channelPath: '/default/*', handler: async () => EventsAuthorized() });

      await expect(matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
    });

    test('skips a route whose operation list does not hold this operation', async () => {
      matcher
        .route(
          defineEventsAuthorizerRoute({ filters: { operation: ['EVENT_CONNECT', 'EVENT_SUBSCRIBE'] } }).handle(
            async () => EventsDenied(),
          ),
        )
        .route(defineEventsAuthorizerRoute().handle(async () => EventsAuthorized()));

      await expect(matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
    });

    test('skips a route whose custom filter says no', async () => {
      matcher
        .route(defineEventsAuthorizerRoute({ filters: { custom: () => false } }).handle(async () => EventsDenied()))
        .route(defineEventsAuthorizerRoute({ filters: { custom: () => true } }).handle(async () => EventsAuthorized()));

      await expect(matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
    });

    test('takes an async custom filter', async () => {
      matcher.route(
        defineEventsAuthorizerRoute({ filters: { custom: async () => true } }).handle(async () => EventsAuthorized()),
      );

      await expect(matcher.handleEvent(createAppSyncEventsAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
    });
  });

  suite('isAppSyncEventsAuthorizerResponse', () => {
    test('takes a response', () => {
      expect(isAppSyncEventsAuthorizerResponse({ isAuthorized: true })).toBe(true);
    });

    test('turns away null', () => {
      expect(isAppSyncEventsAuthorizerResponse(null)).toBe(false);
    });

    test('turns away a string', () => {
      expect(isAppSyncEventsAuthorizerResponse('authorised')).toBe(false);
    });

    test('turns away an object with no isAuthorized', () => {
      expect(isAppSyncEventsAuthorizerResponse({ handlerContext: {} })).toBe(false);
    });

    test('turns away an isAuthorized that is not a boolean', () => {
      expect(isAppSyncEventsAuthorizerResponse({ isAuthorized: 'yes' })).toBe(false);
    });
  });
});

suite('AppSyncEventsAuthorizerMatcher.canHandleEvent', () => {
  const ownEvents = ['createAppSyncEventsAuthorizerEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createAppSyncEventsAuthorizerMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
