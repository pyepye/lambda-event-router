import type { MockInstance } from 'vitest';

import type { Middleware } from '@lambda-event-router/base';
import * as base from '@lambda-event-router/base';
import { createMockContext, createMockSchema } from '@lambda-event-router/testing';

import { defineRoute, HTTPRouter } from './HTTPRouter.js';
import { NoContent, Ok } from './Response.js';
import type { ApiRequest, FinalizedHTTPResponse, HandlerResponse, HTTPAdapter, NormalizedHTTPEvent } from './types.js';

const validateSchemaResultSpy: MockInstance = vi.spyOn(base, 'validateSchemaResult');
type HTTPNext = (request: ApiRequest) => Promise<HandlerResponse>;

interface MockEvent {
  method: string;
  path: string;
  headers?: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
}

interface MockResult {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

const mockAdapter: HTTPAdapter<MockEvent, MockResult> = {
  canHandleEvent(event: unknown): event is MockEvent {
    return typeof event === 'object' && event !== null && 'method' in event && 'path' in event;
  },

  normalize(event: MockEvent): NormalizedHTTPEvent {
    return {
      method: event.method,
      path: event.path,
      headers: event.headers ?? {},
      query: event.query ?? {},
      body: event.body,
      isBase64Encoded: event.isBase64Encoded ?? false,
      auth: undefined,
    };
  },

  buildResult(response: FinalizedHTTPResponse): MockResult {
    return {
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers,
    };
  },
};

function createMockEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  return {
    method: 'GET',
    path: '/',
    ...overrides,
  };
}

suite('HTTPRouter', () => {
  let router: HTTPRouter<MockEvent, MockResult>;

  beforeEach(() => {
    router = new HTTPRouter(mockAdapter);
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid mock event', () => {
      expect(router.canHandleEvent(createMockEvent())).toBe(true);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for a number', () => {
      expect(router.canHandleEvent(42)).toBe(false);
    });

    test('returns false for an array', () => {
      expect(router.canHandleEvent([1, 2, 3])).toBe(false);
    });
  });

  suite('constructor with options object', () => {
    test('accepts an options object with adapter and handles events', async () => {
      const optionsRouter = new HTTPRouter({ adapter: mockAdapter });
      optionsRouter.get({ filters: { path: '/' }, handler: async () => Ok({ message: 'options' }) });

      const event = createMockEvent();
      const context = createMockContext();
      const result = await optionsRouter.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({ statusCode: 200, body: JSON.stringify({ message: 'options' }) }),
      );
    });

    test('applies router-level middleware from options', async () => {
      const middlewareSpy = vi.fn<Middleware<ApiRequest, HandlerResponse>>((request, next) => next(request));
      const optionsRouter = new HTTPRouter({ adapter: mockAdapter, middleware: [middlewareSpy] });
      optionsRouter.get({ filters: { path: '/' }, handler: async () => Ok({ message: 'with middleware' }) });

      const event = createMockEvent();
      const context = createMockContext();
      const result = await optionsRouter.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(middlewareSpy).toHaveBeenCalledOnce();
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: { method: 'GET', path: '/items' },
      }).handle(async () => NoContent());

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('HTTP method chaining', () => {
    test.each([
      { method: 'get' as const, path: '/items', handler: async () => Ok({ items: [] }) },
      { method: 'post' as const, path: '/items', handler: async () => Ok({ id: '1' }) },
      { method: 'put' as const, path: '/items/:id', handler: async () => Ok({ updated: true }) },
      { method: 'patch' as const, path: '/items/:id', handler: async () => Ok({ patched: true }) },
      { method: 'delete' as const, path: '/items/:id', handler: async () => NoContent() },
      { method: 'head' as const, path: '/items/:id', handler: async () => NoContent() },
      { method: 'options' as const, path: '/items', handler: async () => NoContent() },
    ])('$method returns the router instance for chaining', ({ method, path, handler }) => {
      // @ts-expect-error - calling union of method signatures
      const result = router[method]({ filters: { path }, handler });

      expect(result).toBe(router);
    });
  });

  suite('head and options', () => {
    test('head() registers a HEAD route', async () => {
      const handler = vi.fn(async () => NoContent());
      router.head({ filters: { path: '/items/:id' }, handler });

      const result = await router.handleEvent(
        createMockEvent({ method: 'HEAD', path: '/items/9' }),
        createMockContext(),
      );

      expect(handler).toHaveBeenCalledOnce();
      expect(result.statusCode).toBe(204);
    });

    test('head() passes path params to the handler', async () => {
      const handler = vi.fn(async () => NoContent());
      router.head({ filters: { path: '/items/:id' }, handler });

      await router.handleEvent(createMockEvent({ method: 'HEAD', path: '/items/9' }), createMockContext());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: { id: '9' } }));
    });

    test('a HEAD request does not match a GET route', async () => {
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const result = await router.handleEvent(createMockEvent({ method: 'HEAD', path: '/items' }), createMockContext());

      expect(result.statusCode).toBe(404);
    });

    test('a HEAD response drops the body but keeps its status and headers', async () => {
      router.head({ filters: { path: '/items' }, handler: async () => Ok({ total: 3 }) });

      const result = await router.handleEvent(createMockEvent({ method: 'HEAD', path: '/items' }), createMockContext());

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('');
      expect(result.headers).toEqual({ 'content-type': 'application/json' });
    });

    test('a HEAD request to a missing route has no body', async () => {
      const result = await router.handleEvent(createMockEvent({ method: 'HEAD', path: '/missing' }), createMockContext());

      expect(result.statusCode).toBe(404);
      expect(result.body).toBe('');
    });

    test('a HEAD request whose handler throws has no body', async () => {
      router.head({
        filters: { path: '/items' },
        handler: async () => {
          throw new Error('boom');
        },
      });

      const result = await router.handleEvent(createMockEvent({ method: 'HEAD', path: '/items' }), createMockContext());

      expect(result.statusCode).toBe(500);
      expect(result.body).toBe('');
    });

    test('options() registers an OPTIONS route', async () => {
      const handler = vi.fn(async () => NoContent());
      router.options({ filters: { path: '/items' }, handler });

      const result = await router.handleEvent(
        createMockEvent({ method: 'OPTIONS', path: '/items' }),
        createMockContext(),
      );

      expect(handler).toHaveBeenCalledOnce();
      expect(result.statusCode).toBe(204);
    });

    test('options() takes precedence over the automatic CORS preflight', async () => {
      const handler = vi.fn(async () => Ok({ mine: true }));
      const corsRouter = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      corsRouter.get({ filters: { path: '/items' }, handler: async () => Ok({}) });
      corsRouter.options({ filters: { path: '/items' }, handler });

      const event = createMockEvent({ method: 'OPTIONS', path: '/items', headers: { origin: 'https://a.com' } });
      const result = await corsRouter.handleEvent(event, createMockContext());

      expect(handler).toHaveBeenCalledOnce();
      expect(result.body).toBe(JSON.stringify({ mine: true }));
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('neither takes a bodySchema', () => {
      const bodySchema = createMockSchema();

      // @ts-expect-error - a HEAD route has no body to validate
      router.head({ filters: { path: '/items' }, bodySchema, handler: async () => NoContent() });
      // @ts-expect-error - an OPTIONS route has no body to validate
      router.options({ filters: { path: '/items' }, bodySchema, handler: async () => NoContent() });
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { method: 'GET', path: '/items' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves all schemas and handler in the definition', () => {
      const querySchema = createMockSchema();
      const bodySchema = createMockSchema();
      const responseSchema = createMockSchema();
      const handler = vi.fn();

      const definition = defineRoute({
        filters: { method: 'POST', path: '/items/:id' },
        querySchema,
        bodySchema,
        responseSchema,
      }).handle(handler);

      expect(definition.filters.method).toBe('POST');
      expect(definition.filters.path).toBe('/items/:id');
      expect(definition.querySchema).toBe(querySchema);
      expect(definition.bodySchema).toBe(bodySchema);
      expect(definition.responseSchema).toBe(responseSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler and returns a response', async () => {
      router.get({
        filters: { path: '/' },
        handler: async () => Ok({ message: 'hello' }),
      });

      const event = createMockEvent();
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
    });

    test('returns 404 when no route matches', async () => {
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({ path: '/unknown' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not found' }),
        }),
      );
    });

    test('matches a request with a trailing slash against a route registered without one', async () => {
      router.get({
        filters: { path: '/items' },
        handler: async () => Ok({ message: 'items' }),
      });

      const event = createMockEvent({ path: '/items/' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'items' }),
        }),
      );
    });

    test('catches a generic Error and returns 500 with the error message', async () => {
      router.get({
        filters: { path: '/' },
        handler: async () => {
          throw new Error('something broke');
        },
      });

      const event = createMockEvent();
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'something broke' }),
        }),
      );
    });

    test('catches a non-Error throw and returns 500 with default message', async () => {
      router.get({
        filters: { path: '/' },
        handler: async () => {
          throw 'string error';
        },
      });

      const event = createMockEvent();
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        }),
      );
    });

    test('passes extracted path params to the handler', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({ found: true }));
      router.get({ filters: { path: '/items/:id' }, handler });

      const event = createMockEvent({ path: '/items/42' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: { id: '42' } }));
    });

    test('passes query params to the handler', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({ items: [] }));
      router.get({ filters: { path: '/items' }, handler });

      const event = createMockEvent({ path: '/items', query: { page: '2', limit: '10' } });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ query: { page: '2', limit: '10' } }));
    });

    test('passes parsed body to the handler', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({ id: 'new-1' }));
      router.post({ filters: { path: '/items' }, handler });

      const event = createMockEvent({
        method: 'POST',
        path: '/items',
        body: JSON.stringify({ name: 'test-item' }),
      });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { name: 'test-item' } }));
    });

    test('validates the request before calling handler and returns 422 for body schema failure', async () => {
      const handler = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });
      router.post({ filters: { path: '/' }, handler, bodySchema });

      const event = createMockEvent({
        method: 'POST',
        path: '/',
        body: JSON.stringify({ bad: 'data' }),
      });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 422,
        }),
      );
      expect(handler).not.toHaveBeenCalled();
      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ bad: 'data' }, bodySchema);
    });

    test('executes route-level middleware before calling the handler', async () => {
      const middlewareSpy = vi.fn<Middleware<ApiRequest, HandlerResponse>>((request, next) => next(request));
      const route = defineRoute({
        filters: { method: 'GET', path: '/items' },
        // @ts-expect-error - mock middleware uses default generic types, not exact route types
        middleware: [middlewareSpy],
      }).handle(async () => Ok(null));
      router.route(route);

      const event = createMockEvent({ path: '/items' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(middlewareSpy).toHaveBeenCalledOnce();
    });

    test('calls validateSchemaResult with query params and querySchema', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({ items: [] }));
      const querySchema = createMockSchema();
      router.get({ filters: { path: '/items' }, handler, querySchema });

      const event = createMockEvent({ path: '/items', query: { page: '2', limit: '10' } });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      await router.handleEvent(event, context);

      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ page: '2', limit: '10' }, querySchema);
    });
  });

  suite('handleEvent - validated schema output', () => {
    test('hands the handler the coerced query and body, not the raw request values', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({}));
      const querySchema = createMockSchema({ value: { page: 2, dryRun: false } });
      const bodySchema = createMockSchema({ value: { total: 42, currency: 'GBP' } });
      router.post({ filters: { path: '/orders' }, handler, querySchema, bodySchema });

      const event = createMockEvent({
        method: 'POST',
        path: '/orders',
        query: { page: '2' },
        body: JSON.stringify({ total: '42' }),
      });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { page: 2, dryRun: false },
          body: { total: 42, currency: 'GBP' },
        }),
      );
    });
  });

  suite('handleEvent - responseSchema validation', () => {
    test('answers 500 when a bare returned value fails the responseSchema', async () => {
      const handler = vi.fn().mockResolvedValue({ nothingLikeTheSchema: true });
      const responseSchema = createMockSchema({ issues: [{ message: 'missing orderId' }] });
      router.get({ filters: { path: '/orders' }, handler, responseSchema });

      const event = createMockEvent({ path: '/orders' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        }),
      );
    });

    test('sends the coerced schema output for a bare returned value', async () => {
      const handler = vi.fn().mockResolvedValue({ orderId: 1, extra: 'stripped' });
      const responseSchema = createMockSchema({ value: { orderId: '1' } });
      router.get({ filters: { path: '/orders' }, handler, responseSchema });

      const event = createMockEvent({ path: '/orders' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200, body: JSON.stringify({ orderId: '1' }) }));
    });

    test('skips the responseSchema for an explicit HTTP response', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({ handlerChose: true }));
      const responseSchema = createMockSchema({ issues: [{ message: 'missing orderId' }] });
      router.get({ filters: { path: '/orders' }, handler, responseSchema });

      const event = createMockEvent({ path: '/orders' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({ statusCode: 200, body: JSON.stringify({ handlerChose: true }) }),
      );
    });
  });

  suite('handleEvent - customFilter', () => {
    test('matches route when customFilter returns true', async () => {
      const handler = vi.fn(async () => Ok({ message: 'hello' }));
      router.get({
        filters: { path: '/items', customFilter: () => true },
        handler,
      });

      const event = createMockEvent({ path: '/items' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
      expect(handler).toHaveBeenCalledOnce();
    });

    test('returns 404 when customFilter returns false', async () => {
      const handler = vi.fn(async () => Ok({}));
      router.get({
        filters: { path: '/items', customFilter: () => false },
        handler,
      });

      const event = createMockEvent({ path: '/items' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not found' }),
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('passes HTTPFilterInput populated from the normalized event', async () => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.post({
        filters: { path: '/items', customFilter },
        handler: async () => Ok({}),
      });

      const event = createMockEvent({
        method: 'POST',
        path: '/items',
        headers: { 'x-trace-id': 'abc' },
        query: { page: '1' },
        body: '{"name":"thing"}',
      });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      await router.handleEvent(event, context);

      expect(customFilter).toHaveBeenCalledOnce();
      expect(customFilter).toHaveBeenCalledWith({
        method: 'POST',
        path: '/items',
        headers: { 'x-trace-id': 'abc' },
        query: { page: '1' },
        body: '{"name":"thing"}',
        auth: undefined,
        event,
      });
    });

    test('matches route when customFilter is async and resolves true', async () => {
      router.get({
        filters: {
          path: '/items',
          customFilter: async () => {
            await new Promise((r) => setTimeout(r, 1));
            return true;
          },
        },
        handler: async () => Ok({ matched: true }),
      });
      const event = createMockEvent({ method: 'GET', path: '/items' });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);
      expect(result.statusCode).toBe(200);
    });

    test('returns 404 when async customFilter resolves false', async () => {
      router.get({
        filters: {
          path: '/items',
          customFilter: async () => {
            await new Promise((r) => setTimeout(r, 1));
            return false;
          },
        },
        handler: async () => Ok({ matched: true }),
      });
      const event = createMockEvent({ method: 'GET', path: '/items' });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);
      expect(result.statusCode).toBe(404);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async () => {
      const callOrder: string[] = [];

      const middleware: Middleware<ApiRequest, HandlerResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      };

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [middleware] });
      router.get({
        filters: { path: '/' },
        handler: async () => {
          callOrder.push('handler');
          return Ok({ message: 'hello' });
        },
      });

      const event = createMockEvent();
      const context = createMockContext();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to short-circuit with an early response', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({}));

      const authMiddleware: Middleware<ApiRequest, HandlerResponse> = async () => {
        return { statusCode: 401, body: null };
      };

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [authMiddleware] });
      router.get({ filters: { path: '/' }, handler });

      const event = createMockEvent();
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 401 }));
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async () => {
      const callOrder: string[] = [];

      const middlewareOne: Middleware<ApiRequest, HandlerResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('mw1');
        return next(request);
      };

      const middlewareTwo: Middleware<ApiRequest, HandlerResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('mw2');
        return next(request);
      };

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [middlewareOne, middlewareTwo] });
      router.get({
        filters: { path: '/' },
        handler: async () => {
          callOrder.push('handler');
          return Ok({});
        },
      });

      const event = createMockEvent();
      const context = createMockContext();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });

    test('does not execute middleware when body schema validation fails', async () => {
      const middleware = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [middleware] });
      router.post({ filters: { path: '/' }, handler: async () => Ok({}), bodySchema });

      const event = createMockEvent({ method: 'POST', path: '/', body: JSON.stringify({ bad: 'data' }) });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 422 }));
      expect(middleware).not.toHaveBeenCalled();
    });
  });

  suite('route-level middleware', () => {
    test('allows route-level middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({}));

      const blockingRouteMiddleware: Middleware<ApiRequest, HandlerResponse> = async () => {
        return { statusCode: 403, body: null };
      };

      const route = defineRoute({
        filters: { method: 'GET', path: '/' },
        // @ts-expect-error - mock middleware uses default generic types, not exact route types
        middleware: [blockingRouteMiddleware],
      }).handle(handler);
      router.route(route);

      const event = createMockEvent();
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 403 }));
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async () => {
      const callOrder: string[] = [];

      const routeMiddlewareOne: Middleware<ApiRequest, HandlerResponse> = async (
        request: ApiRequest,
        next: HTTPNext,
      ) => {
        callOrder.push('route-mw1');
        return next(request);
      };

      const routeMiddlewareTwo: Middleware<ApiRequest, HandlerResponse> = async (
        request: ApiRequest,
        next: HTTPNext,
      ) => {
        callOrder.push('route-mw2');
        return next(request);
      };

      const route = defineRoute({
        filters: { method: 'GET', path: '/' },
        // @ts-expect-error - mock middleware uses default generic types, not exact route types
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
      }).handle(async () => {
        callOrder.push('handler');
        return Ok({});
      });
      router.route(route);

      const event = createMockEvent();
      const context = createMockContext();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async () => {
      const callOrder: string[] = [];

      const routerMiddleware: Middleware<ApiRequest, HandlerResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('router-mw');
        return next(request);
      };

      const routeMiddleware: Middleware<ApiRequest, HandlerResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('route-mw');
        return next(request);
      };

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [routerMiddleware] });
      const route = defineRoute({
        filters: { method: 'GET', path: '/' },
        // @ts-expect-error - mock middleware uses default generic types, not exact route types
        middleware: [routeMiddleware],
      }).handle(async () => {
        callOrder.push('handler');
        return Ok({});
      });
      router.route(route);

      const event = createMockEvent();
      const context = createMockContext();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async () => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn().mockResolvedValue(Ok({}));

      const blockingMiddleware: Middleware<ApiRequest, HandlerResponse> = async () => {
        return { statusCode: 403, body: null };
      };

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [blockingMiddleware] });
      router.get({ filters: { path: '/' }, middleware: [routeMiddleware], handler });

      const event = createMockEvent();
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 403 }));
      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run for unmatched routes', () => {
    test('returns 404 without running middleware when no route matches', async () => {
      const middleware = vi.fn();

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [middleware] });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({ path: '/unknown' });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 404 }));
      expect(middleware).not.toHaveBeenCalled();
    });
  });

  suite('handleEvent - CORS preflight', () => {
    test('returns 204 with CORS headers for OPTIONS request with wildcard origin', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://example.com' },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.headers).toEqual(
        expect.objectContaining({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        }),
      );
    });

    test('returns correct Allow-Methods for path with multiple methods', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });
      router.post({ filters: { path: '/items' }, handler: async () => Ok({}) });
      router.delete({ filters: { path: '/items/:id' }, handler: async () => Ok({}) });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://example.com' },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.headers?.['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    });

    test('returns 204 with matching origin from allowed list', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: { origin: ['https://allowed.com', 'https://also-allowed.com'] },
      });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://allowed.com' },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('https://allowed.com');
      expect(result.headers?.Vary).toBe('Origin');
    });

    test('returns 404 for preflight on non-matching origin from allowed list', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: { origin: ['https://allowed.com'] },
      });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://denied.com' },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(404);
      expect(result.headers?.Vary).toEqual('Origin');
    });

    test('returns 204 with dynamic origin function', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: {
          origin: (origin: string, _path: string) => {
            if (origin.endsWith('.example.com')) return origin;
            return undefined;
          },
        },
      });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://app.example.com' },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    });

    test('passes path to dynamic origin function', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: {
          origin: (_origin: string, path: string) => {
            if (path.startsWith('/public')) return '*';
            return undefined;
          },
        },
      });
      router.get({ filters: { path: '/public/data' }, handler: async () => Ok({}) });
      router.get({ filters: { path: '/private/data' }, handler: async () => Ok({}) });

      const context = createMockContext();

      const publicResult = await router.handleEvent(
        createMockEvent({ method: 'OPTIONS', path: '/public/data', headers: { origin: 'https://any.com' } }),
        context,
      );
      expect(publicResult.statusCode).toBe(204);
      expect(publicResult.headers?.['Access-Control-Allow-Origin']).toBe('*');

      const privateResult = await router.handleEvent(
        createMockEvent({ method: 'OPTIONS', path: '/private/data', headers: { origin: 'https://any.com' } }),
        context,
      );
      expect(privateResult.statusCode).toBe(404);
    });

    test('returns 404 for preflight on unregistered path', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/unknown',
        headers: { origin: 'https://example.com' },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(404);
    });

    test('reflects Access-Control-Request-Headers in preflight response', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.post({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: {
          origin: 'https://example.com',
          'access-control-request-headers': 'Content-Type, Authorization',
        },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
    });

    test('includes maxAge in preflight response', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*', maxAge: 86400 } });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://example.com' },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.headers?.['Access-Control-Max-Age']).toBe('86400');
    });

    test('returns 204 for preflight on parameterized path', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.delete({ filters: { path: '/items/:id' }, handler: async () => NoContent() });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items/123',
        headers: { origin: 'https://example.com' },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.headers?.['Access-Control-Allow-Methods']).toBe('DELETE, OPTIONS');
    });

    test('uses configured allowedHeaders in preflight response', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: { origin: '*', allowedHeaders: ['Content-Type', 'Authorization'] },
      });
      router.post({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: {
          origin: 'https://example.com',
          'access-control-request-headers': 'Content-Type, Authorization, X-Custom',
        },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
    });

    test('includes credentials in preflight response', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: { origin: ['https://example.com'], credentials: true },
      });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://example.com' },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.headers?.['Access-Control-Allow-Credentials']).toBe('true');
    });

    test('lists OPTIONS once when the path has its own OPTIONS route', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });
      router.route({ filters: { method: 'OPTIONS', path: '/other' }, handler: async () => NoContent() });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://example.com' },
      });
      const result = await router.handleEvent(event, createMockContext());

      expect(result.headers?.['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
    });
  });

  suite('handleEvent - CORS preflight versus a registered OPTIONS route', () => {
    test('runs a registered OPTIONS route instead of the automatic preflight', async () => {
      const handler = vi.fn(async () => Ok({ mine: true }));
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });
      router.route({ filters: { method: 'OPTIONS', path: '/items' }, handler });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://example.com' },
      });
      const result = await router.handleEvent(event, createMockContext());

      expect(handler).toHaveBeenCalledOnce();
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe(JSON.stringify({ mine: true }));
    });

    test('adds CORS headers to a registered OPTIONS route response', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.route({
        filters: { method: 'OPTIONS', path: '/items' },
        handler: async () => ({ statusCode: 204, body: undefined, headers: { 'X-Mine': 'yes' } }),
      });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://example.com' },
      });
      const result = await router.handleEvent(event, createMockContext());

      expect(result.statusCode).toBe(204);
      expect(result.headers).toEqual(expect.objectContaining({ 'Access-Control-Allow-Origin': '*', 'X-Mine': 'yes' }));
    });

    test('falls back to the automatic preflight when a registered OPTIONS route filters the request out', async () => {
      const handler = vi.fn(async () => Ok({ mine: true }));
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });
      router.route({
        filters: { method: 'OPTIONS', path: '/items', customFilter: () => false },
        handler,
      });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://example.com' },
      });
      const result = await router.handleEvent(event, createMockContext());

      expect(handler).not.toHaveBeenCalled();
      expect(result.statusCode).toBe(204);
      expect(result.headers?.['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
    });

    test('runs a registered OPTIONS route when CORS is off', async () => {
      const handler = vi.fn(async () => Ok({ mine: true }));
      const router = new HTTPRouter({ adapter: mockAdapter });
      router.route({ filters: { method: 'OPTIONS', path: '/items' }, handler });

      const event = createMockEvent({ method: 'OPTIONS', path: '/items' });
      const result = await router.handleEvent(event, createMockContext());

      expect(handler).toHaveBeenCalledOnce();
      expect(result.statusCode).toBe(200);
    });

    test('runs route middleware for a registered OPTIONS route', async () => {
      const order: string[] = [];
      const middleware: Middleware<ApiRequest, HandlerResponse> = async (request: ApiRequest, next: HTTPNext) => {
        order.push('middleware');
        return next(request);
      };
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.route({
        filters: { method: 'OPTIONS', path: '/items' },
        middleware: [middleware],
        handler: async () => {
          order.push('handler');
          return NoContent();
        },
      });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://example.com' },
      });
      await router.handleEvent(event, createMockContext());

      expect(order).toEqual(['middleware', 'handler']);
    });
  });

  suite('handleEvent - CORS', () => {
    test('adds CORS headers to successful response', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({ data: 'test' }) });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('adds CORS headers to 404 response', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({ path: '/unknown', headers: { origin: 'https://example.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(404);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('adds CORS headers to error responses from thrown errors', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({
        filters: { path: '/items' },
        handler: async () => {
          throw new Error('something broke');
        },
      });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(500);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('adds CORS headers to thrown HTTPResponse errors', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({
        filters: { path: '/items' },
        handler: async () => {
          throw { statusCode: 400, body: { error: 'bad input' } };
        },
      });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(400);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('CORS headers take precedence over handler-set headers', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({
        filters: { path: '/items' },
        handler: async () => ({
          statusCode: 200,
          body: { data: 'test' },
          headers: { 'X-Custom': 'value', 'Access-Control-Allow-Origin': 'https://evil.com' },
        }),
      });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['X-Custom']).toBe('value');
    });

    test('adds only Vary: Origin when origin is not allowed with dynamic origins', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: { origin: ['https://allowed.com'] },
      });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({ data: 'test' }) });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://denied.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.Vary).toEqual('Origin');
    });

    test('includes Vary: Origin for non-wildcard origins', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: { origin: ['https://example.com'] },
      });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.headers?.Vary).toBe('Origin');
    });

    test('adds CORS headers to validation failure (422) response', async () => {
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.post({ filters: { path: '/items' }, handler: async () => Ok({}), bodySchema });

      const event = createMockEvent({
        method: 'POST',
        path: '/items',
        body: JSON.stringify({ bad: 'data' }),
        headers: { origin: 'https://example.com' },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(422);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('adds CORS headers to non-Error throw response', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({
        filters: { path: '/items' },
        handler: async () => {
          throw 'string error';
        },
      });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(500);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('adds CORS headers when no origin header with wildcard config', async () => {
      const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({ path: '/items' });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('adds only Vary: Origin when no origin header with dynamic origin', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: { origin: ['https://allowed.com'] },
      });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({ path: '/items' });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.Vary).toEqual('Origin');
    });

    test('adds CORS headers for allowed function origin on actual request', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: {
          origin: (origin: string) => {
            if (origin.endsWith('.example.com')) return origin;
            return undefined;
          },
        },
      });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://app.example.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('https://app.example.com');
      expect(result.headers?.Vary).toBe('Origin');
    });

    test('adds only Vary: Origin for denied function origin on actual request', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: {
          origin: () => undefined,
        },
      });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://denied.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.Vary).toEqual('Origin');
    });

    test('includes credentials on actual response', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: { origin: ['https://example.com'], credentials: true },
      });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Access-Control-Allow-Credentials']).toBe('true');
    });

    test('includes exposedHeaders on actual responses', async () => {
      const router = new HTTPRouter({
        adapter: mockAdapter,
        cors: { origin: '*', exposedHeaders: ['X-Request-Id'] },
      });
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.headers?.['Access-Control-Expose-Headers']).toBe('X-Request-Id');
    });
  });

  suite('constructor - CORS configuration validation', () => {
    test('throws when credentials is true with wildcard origin', () => {
      expect(() => new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*', credentials: true } })).toThrow(
        'CORS configuration error: credentials cannot be used with wildcard (*) origin',
      );
    });

    test('allows credentials with specific origin', () => {
      expect(
        () => new HTTPRouter({ adapter: mockAdapter, cors: { origin: 'https://example.com', credentials: true } }),
      ).not.toThrow();
    });

    test('allows credentials with array origins', () => {
      expect(
        () => new HTTPRouter({ adapter: mockAdapter, cors: { origin: ['https://example.com'], credentials: true } }),
      ).not.toThrow();
    });
  });

  suite('handleEvent - no CORS configured', () => {
    test('does not add CORS headers when cors is not configured', async () => {
      router.get({ filters: { path: '/items' }, handler: async () => Ok({ data: 'test' }) });

      const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toEqual({ 'content-type': 'application/json' });
    });

    test('does not handle OPTIONS preflight when cors is not configured', async () => {
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const event = createMockEvent({
        method: 'OPTIONS',
        path: '/items',
        headers: { origin: 'https://example.com' },
      });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result.statusCode).toBe(404);
    });
  });
});
