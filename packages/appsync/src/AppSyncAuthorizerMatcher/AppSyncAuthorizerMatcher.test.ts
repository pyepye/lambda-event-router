import { allEventBuilders, createAppSyncAuthorizerEvent, createMockContext, test } from '@latcher/testing';

import {
  AppSyncAuthorizerMatcher,
  createAppSyncAuthorizerMatcher,
  defineAuthorizerRoute,
} from './AppSyncAuthorizerMatcher.js';
import { Authorized, Denied } from './response.js';
import type { AppSyncAuthorizerRequest, AppSyncAuthorizerResponse } from './types.js';

type AuthorizerNext = (request: AppSyncAuthorizerRequest) => Promise<AppSyncAuthorizerResponse>;

let matcher: AppSyncAuthorizerMatcher;

beforeEach(() => {
  matcher = new AppSyncAuthorizerMatcher();
});

suite('AppSyncAuthorizerMatcher', () => {
  suite('createAppSyncAuthorizerMatcher', () => {
    test('creates an AppSyncAuthorizerMatcher instance', () => {
      const matcher = createAppSyncAuthorizerMatcher();
      expect(matcher).toBeInstanceOf(AppSyncAuthorizerMatcher);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid AppSync authorizer event', () => {
      const event = createAppSyncAuthorizerEvent();
      expect(matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(matcher.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(matcher.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when authorizationToken is missing', () => {
      expect(
        matcher.canHandleEvent({
          requestContext: { apiId: 'id', accountId: 'acc', queryString: 'q', operationName: 'op' },
        }),
      ).toBe(false);
    });

    test('returns false when authorizationToken is not a string', () => {
      expect(
        matcher.canHandleEvent({
          authorizationToken: 123,
          requestContext: { apiId: 'id', accountId: 'acc', queryString: 'q', operationName: 'op' },
        }),
      ).toBe(false);
    });

    test('returns false when requestContext is missing', () => {
      expect(matcher.canHandleEvent({ authorizationToken: 'Bearer token' })).toBe(false);
    });

    test('returns false when requestContext is not an object', () => {
      expect(matcher.canHandleEvent({ authorizationToken: 'Bearer token', requestContext: 'not-object' })).toBe(false);
    });

    test('returns false when apiId is missing', () => {
      expect(
        matcher.canHandleEvent({
          authorizationToken: 'Bearer token',
          requestContext: { accountId: 'acc', queryString: 'q', operationName: 'op' },
        }),
      ).toBe(false);
    });

    test('returns false when apiId is not a string', () => {
      expect(
        matcher.canHandleEvent({
          authorizationToken: 'Bearer token',
          requestContext: { apiId: 123, accountId: 'acc', queryString: 'q', operationName: 'op' },
        }),
      ).toBe(false);
    });

    test('returns false when accountId is not a string', () => {
      expect(
        matcher.canHandleEvent({
          authorizationToken: 'Bearer token',
          requestContext: { apiId: 'id', accountId: 123, queryString: 'q', operationName: 'op' },
        }),
      ).toBe(false);
    });

    test('returns false when queryString is not a string', () => {
      expect(
        matcher.canHandleEvent({
          authorizationToken: 'Bearer token',
          requestContext: { apiId: 'id', accountId: 'acc', queryString: 123, operationName: 'op' },
        }),
      ).toBe(false);
    });

    test('returns false when operationName is not a string', () => {
      expect(
        matcher.canHandleEvent({
          authorizationToken: 'Bearer token',
          requestContext: { apiId: 'id', accountId: 'acc', queryString: 'q', operationName: 123 },
        }),
      ).toBe(false);
    });

    test('returns true when operationName is missing, as it is on an unnamed operation', () => {
      expect(
        matcher.canHandleEvent({
          authorizationToken: 'Bearer token',
          requestContext: { apiId: 'id', accountId: 'acc', queryString: 'query { getUser { id } }' },
        }),
      ).toBe(true);
    });
  });

  suite('defineAuthorizerRoute', () => {
    test('preserves handler', () => {
      const handler = vi.fn();
      const definition = defineAuthorizerRoute().handle(handler);

      expect(definition.handler).toBe(handler);
    });
  });

  suite('route', () => {
    test('returns this for chaining', () => {
      const handler = vi.fn();

      const result = matcher.route({ handler });
      expect(result).toBe(matcher);
    });
  });

  suite('handleEvent', () => {
    test('throws when no route is registered', async () => {
      const event = createAppSyncAuthorizerEvent({ requestContext: { apiId: 'test-api-id' } });

      await expect(matcher.handleEvent(event, createMockContext())).rejects.toThrow(
        'No authorizer route matched for GetUser on test-api-id',
      );
    });

    test('names only the api when the caller does not name its operation', async () => {
      const event = createAppSyncAuthorizerEvent({ requestContext: { operationName: undefined } });

      await expect(matcher.handleEvent(event, createMockContext())).rejects.toThrow(
        'No authorizer route matched for test-api-id',
      );
    });

    test('returns the response when handler throws an AppSyncAuthorizerResponse', async () => {
      const thrownResponse = { isAuthorized: false, deniedFields: ['secret'] };
      const handler = vi.fn().mockRejectedValue(thrownResponse);

      matcher.route({ handler });

      const event = createAppSyncAuthorizerEvent();
      const context = createMockContext();

      const result = await matcher.handleEvent(event, context);
      expect(result).toBe(thrownResponse);
    });

    test('re-throws when handler throws a non-response error', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('unexpected failure'));
      matcher.route({ handler });

      const event = createAppSyncAuthorizerEvent();
      const context = createMockContext();

      await expect(matcher.handleEvent(event, context)).rejects.toThrow('unexpected failure');
    });

    test('builds complete AppSyncAuthorizerRequest and calls handler', async () => {
      const handler = vi.fn().mockResolvedValue({ isAuthorized: true });
      matcher.route({ handler });

      const event = createAppSyncAuthorizerEvent({
        authorizationToken: 'Bearer my-token',
        requestHeaders: { host: 'api.example.com' },
        requestContext: {
          apiId: 'my-api',
          accountId: '999888777666',
          queryString: 'query { listUsers { id } }',
          operationName: 'ListUsers',
          variables: { limit: 10 },
        },
      });
      const context = createMockContext();

      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ isAuthorized: true });
      expect(handler).toHaveBeenCalledOnce();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationToken: 'Bearer my-token',
          requestHeaders: { host: 'api.example.com' },
          apiId: 'my-api',
          accountId: '999888777666',
          requestId: event.requestContext.requestId,
          queryString: 'query { listUsers { id } }',
          operationName: 'ListUsers',
          variables: { limit: 10 },
          event,
          context,
        }),
      );
    });
  });

  suite('matcher-level middleware', () => {
    test('executes middleware before the route handler', async () => {
      const callOrder: string[] = [];

      async function middleware(
        request: AppSyncAuthorizerRequest,
        next: AuthorizerNext,
      ): Promise<AppSyncAuthorizerResponse> {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      }

      const matcher = createAppSyncAuthorizerMatcher({ middleware: [middleware] });
      matcher.route(
        defineAuthorizerRoute().handle(async () => {
          callOrder.push('handler');
          return { isAuthorized: true };
        }),
      );

      await matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext());

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to short-circuit with an early return', async () => {
      const handler = vi.fn().mockResolvedValue({ isAuthorized: true });

      async function blockingMiddleware(
        _request: AppSyncAuthorizerRequest,
        _next: AuthorizerNext,
      ): Promise<AppSyncAuthorizerResponse> {
        return { isAuthorized: false };
      }

      const matcher = createAppSyncAuthorizerMatcher({ middleware: [blockingMiddleware] });
      matcher.route(defineAuthorizerRoute().handle(handler));

      const result = await matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext());

      expect(result).toEqual({ isAuthorized: false });
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple matcher-level middleware in order', async () => {
      const callOrder: string[] = [];

      async function middlewareOne(
        request: AppSyncAuthorizerRequest,
        next: AuthorizerNext,
      ): Promise<AppSyncAuthorizerResponse> {
        callOrder.push('mw1');
        return next(request);
      }

      async function middlewareTwo(
        request: AppSyncAuthorizerRequest,
        next: AuthorizerNext,
      ): Promise<AppSyncAuthorizerResponse> {
        callOrder.push('mw2');
        return next(request);
      }

      const matcher = createAppSyncAuthorizerMatcher({ middleware: [middlewareOne, middlewareTwo] });
      matcher.route(
        defineAuthorizerRoute().handle(async () => {
          callOrder.push('handler');
          return { isAuthorized: true };
        }),
      );

      await matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext());

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });

    test('catches a response thrown from within the middleware chain', async () => {
      const thrownResponse = { isAuthorized: false, deniedFields: ['secret'] };

      async function throwingMiddleware(
        _request: AppSyncAuthorizerRequest,
        _next: AuthorizerNext,
      ): Promise<AppSyncAuthorizerResponse> {
        throw thrownResponse;
      }

      const matcher = createAppSyncAuthorizerMatcher({ middleware: [throwingMiddleware] });
      matcher.route(defineAuthorizerRoute().handle(async () => ({ isAuthorized: true })));

      const result = await matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext());

      expect(result).toBe(thrownResponse);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware from defineAuthorizerRoute', async () => {
      const callOrder: string[] = [];

      async function routeMiddleware(
        request: AppSyncAuthorizerRequest,
        next: AuthorizerNext,
      ): Promise<AppSyncAuthorizerResponse> {
        callOrder.push('route-mw');
        return next(request);
      }

      matcher.route(
        defineAuthorizerRoute({ middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
          return { isAuthorized: true };
        }),
      );

      await matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext());

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined matcher and route middleware', () => {
    test('executes matcher middleware before route middleware', async () => {
      const callOrder: string[] = [];

      async function matcherMiddleware(
        request: AppSyncAuthorizerRequest,
        next: AuthorizerNext,
      ): Promise<AppSyncAuthorizerResponse> {
        callOrder.push('matcher-mw');
        return next(request);
      }

      async function routeMiddleware(
        request: AppSyncAuthorizerRequest,
        next: AuthorizerNext,
      ): Promise<AppSyncAuthorizerResponse> {
        callOrder.push('route-mw');
        return next(request);
      }

      const matcher = createAppSyncAuthorizerMatcher({ middleware: [matcherMiddleware] });
      matcher.route(
        defineAuthorizerRoute({ middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
          return { isAuthorized: true };
        }),
      );

      await matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext());

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });
  });

  suite('filters', () => {
    test('matches on the api id', async () => {
      const other = vi.fn();
      matcher
        .route(defineAuthorizerRoute({ filters: { apiId: 'other-api' } }).handle(other))
        .route(defineAuthorizerRoute({ filters: { apiId: 'test-api-id' } }).handle(async () => Authorized()));

      await expect(matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
      expect(other).not.toHaveBeenCalled();
    });

    test('does not match when the apiId filter is an empty string', async () => {
      matcher.route(defineAuthorizerRoute({ filters: { apiId: '' } }).handle(async () => Authorized()));

      await expect(matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext())).rejects.toThrow();
    });

    test('matches an api id by wildcard', async () => {
      matcher.route(defineAuthorizerRoute({ filters: { apiId: 'test-*' } }).handle(async () => Authorized()));

      await expect(matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
    });

    test('orders an exact api id ahead of the wildcard that covers it', async () => {
      const wildcard = vi.fn();
      matcher
        .route(defineAuthorizerRoute({ filters: { apiId: 'test-*' } }).handle(wildcard))
        .route(defineAuthorizerRoute({ filters: { apiId: 'test-api-id' } }).handle(async () => Authorized()));

      await expect(matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
      expect(wildcard).not.toHaveBeenCalled();
    });

    test('orders a guarded route ahead of the fallback it shares filters with', async () => {
      const fallback = vi.fn();
      matcher
        .route(defineAuthorizerRoute({ filters: { apiId: 'test-api-id' } }).handle(fallback))
        .route(
          defineAuthorizerRoute({ filters: { apiId: 'test-api-id', custom: () => true } }).handle(async () =>
            Authorized(),
          ),
        );

      await expect(matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
      expect(fallback).not.toHaveBeenCalled();
    });

    test('matches on the operation name', async () => {
      const other = vi.fn();
      matcher
        .route(defineAuthorizerRoute({ filters: { operationName: 'AdminAudit' } }).handle(other))
        .route(defineAuthorizerRoute({ filters: { operationName: 'GetUser' } }).handle(async () => Authorized()));

      await expect(matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
      expect(other).not.toHaveBeenCalled();
    });

    test('skips an operation name filter when the caller names no operation', async () => {
      const named = vi.fn();
      matcher
        .route(defineAuthorizerRoute({ filters: { operationName: 'GetUser' } }).handle(named))
        .route(defineAuthorizerRoute().handle(async () => Authorized()));

      const event = createAppSyncAuthorizerEvent({ requestContext: { operationName: undefined } });

      await expect(matcher.handleEvent(event, createMockContext())).resolves.toEqual({ isAuthorized: true });
      expect(named).not.toHaveBeenCalled();
    });

    test('asks the custom filter with the api and the operation', async () => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.route(defineAuthorizerRoute({ filters: { custom } }).handle(async () => Authorized()));

      await matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext());

      expect(custom).toHaveBeenCalledWith(expect.objectContaining({ apiId: 'test-api-id', operationName: 'GetUser' }));
    });

    test('skips a route whose custom filter says no', async () => {
      matcher
        .route(defineAuthorizerRoute({ filters: { custom: () => false } }).handle(async () => Denied()))
        .route(defineAuthorizerRoute({ filters: { custom: async () => true } }).handle(async () => Authorized()));

      await expect(matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
    });

    test('keeps every registered route rather than replacing the last', async () => {
      matcher
        .route(defineAuthorizerRoute({ filters: { apiId: 'first-api' } }).handle(async () => Denied()))
        .route(defineAuthorizerRoute({ filters: { apiId: 'test-api-id' } }).handle(async () => Authorized()));

      await expect(matcher.handleEvent(createAppSyncAuthorizerEvent(), createMockContext())).resolves.toEqual({
        isAuthorized: true,
      });
    });
  });
});

suite('AppSyncAuthorizerMatcher.canHandleEvent', () => {
  const ownEvents = ['createAppSyncAuthorizerEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createAppSyncAuthorizerMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
