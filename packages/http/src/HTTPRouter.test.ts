import type { Middleware } from '@lambda-event-router/base';
import * as base from '@lambda-event-router/base';
import { createMockContext, createMockSchema } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
import { defineRoute, HTTPRouter } from './HTTPRouter.js';
import { NoContent, Ok } from './Response.js';
import type { ApiRequest, ApiResponse, FinalizedHTTPResponse, HTTPAdapter, NormalizedHTTPEvent } from './types.js';

const validateSchemaResultSpy: MockInstance = vi.spyOn(base, 'validateSchemaResult');
type HTTPNext = (request: ApiRequest) => Promise<ApiResponse>;

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
      optionsRouter.get({ path: '/', handler: async () => Ok({ message: 'options' }) });

      const event = createMockEvent();
      const context = createMockContext();
      const result = await optionsRouter.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({ statusCode: 200, body: JSON.stringify({ message: 'options' }) }),
      );
    });

    test('applies router-level middleware from options', async () => {
      const middlewareSpy = vi.fn<Middleware<ApiRequest, ApiResponse>>((request, next) => next(request));
      const optionsRouter = new HTTPRouter({ adapter: mockAdapter, middleware: [middlewareSpy] });
      optionsRouter.get({ path: '/', handler: async () => Ok({ message: 'with middleware' }) });

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
        method: 'GET',
        path: '/items',
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
    ])('$method returns the router instance for chaining', ({ method, path, handler }) => {
      // @ts-expect-error - calling union of method signatures
      const result = router[method]({ path, handler });

      expect(result).toBe(router);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        method: 'GET',
        path: '/items',
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
        method: 'POST',
        path: '/items/:id',
        querySchema,
        bodySchema,
        responseSchema,
      }).handle(handler);

      expect(definition.method).toBe('POST');
      expect(definition.path).toBe('/items/:id');
      expect(definition.querySchema).toBe(querySchema);
      expect(definition.bodySchema).toBe(bodySchema);
      expect(definition.responseSchema).toBe(responseSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler and returns a response', async () => {
      router.get({
        path: '/',
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
      router.get({ path: '/items', handler: async () => Ok({}) });

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

    test('catches a generic Error and returns 500 with the error message', async () => {
      router.get({
        path: '/',
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
        path: '/',
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
      router.get({ path: '/items/:id', handler });

      const event = createMockEvent({ path: '/items/42' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: { id: '42' } }));
    });

    test('passes query params to the handler', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({ items: [] }));
      router.get({ path: '/items', handler });

      const event = createMockEvent({ path: '/items', query: { page: '2', limit: '10' } });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ query: { page: '2', limit: '10' } }));
    });

    test('passes parsed body to the handler', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({ id: 'new-1' }));
      router.post({ path: '/items', handler });

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
      router.post({ path: '/', handler, bodySchema });

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
      const middlewareSpy = vi.fn<Middleware<ApiRequest, ApiResponse>>((request, next) => next(request));
      const route = defineRoute({
        method: 'GET',
        path: '/items',
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
      router.get({ path: '/items', handler, querySchema });

      const event = createMockEvent({ path: '/items', query: { page: '2', limit: '10' } });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      await router.handleEvent(event, context);

      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ page: '2', limit: '10' }, querySchema);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async () => {
      const callOrder: string[] = [];

      const middleware: Middleware<ApiRequest, ApiResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      };

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [middleware] });
      router.get({
        path: '/',
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

      const authMiddleware: Middleware<ApiRequest, ApiResponse> = async () => {
        return { statusCode: 401, body: null };
      };

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [authMiddleware] });
      router.get({ path: '/', handler });

      const event = createMockEvent();
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 401 }));
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async () => {
      const callOrder: string[] = [];

      const middlewareOne: Middleware<ApiRequest, ApiResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('mw1');
        return next(request);
      };

      const middlewareTwo: Middleware<ApiRequest, ApiResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('mw2');
        return next(request);
      };

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [middlewareOne, middlewareTwo] });
      router.get({
        path: '/',
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
      router.post({ path: '/', handler: async () => Ok({}), bodySchema });

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

      const blockingRouteMiddleware: Middleware<ApiRequest, ApiResponse> = async () => {
        return { statusCode: 403, body: null };
      };

      const route = defineRoute({
        method: 'GET',
        path: '/',
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

      const routeMiddlewareOne: Middleware<ApiRequest, ApiResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('route-mw1');
        return next(request);
      };

      const routeMiddlewareTwo: Middleware<ApiRequest, ApiResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('route-mw2');
        return next(request);
      };

      const route = defineRoute({
        method: 'GET',
        path: '/',
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

      const routerMiddleware: Middleware<ApiRequest, ApiResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('router-mw');
        return next(request);
      };

      const routeMiddleware: Middleware<ApiRequest, ApiResponse> = async (request: ApiRequest, next: HTTPNext) => {
        callOrder.push('route-mw');
        return next(request);
      };

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [routerMiddleware] });
      const route = defineRoute({
        method: 'GET',
        path: '/',
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

      const blockingMiddleware: Middleware<ApiRequest, ApiResponse> = async () => {
        return { statusCode: 403, body: null };
      };

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [blockingMiddleware] });
      router.get({ path: '/', middleware: [routeMiddleware], handler });

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
      router.get({ path: '/items', handler: async () => Ok({}) });

      const event = createMockEvent({ path: '/unknown' });
      const context = createMockContext();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 404 }));
      expect(middleware).not.toHaveBeenCalled();
    });
  });

  suite('CORS', () => {
    suite('preflight requests', () => {
      test('returns 204 with CORS headers for OPTIONS request with wildcard origin', async () => {
        const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
        router.get({ path: '/items', handler: async () => Ok({}) });

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
        router.get({ path: '/items', handler: async () => Ok({}) });
        router.post({ path: '/items', handler: async () => Ok({}) });
        router.delete({ path: '/items/:id', handler: async () => Ok({}) });

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
        router.get({ path: '/items', handler: async () => Ok({}) });

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
        router.get({ path: '/items', handler: async () => Ok({}) });

        const event = createMockEvent({
          method: 'OPTIONS',
          path: '/items',
          headers: { origin: 'https://denied.com' },
        });
        const context = createMockContext();
        const result = await router.handleEvent(event, context);

        expect(result.statusCode).toBe(404);
        expect(result.headers).toEqual({ Vary: 'Origin' });
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
        router.get({ path: '/items', handler: async () => Ok({}) });

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
        router.get({ path: '/public/data', handler: async () => Ok({}) });
        router.get({ path: '/private/data', handler: async () => Ok({}) });

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
        router.get({ path: '/items', handler: async () => Ok({}) });

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
        router.post({ path: '/items', handler: async () => Ok({}) });

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
        router.get({ path: '/items', handler: async () => Ok({}) });

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
        router.delete({ path: '/items/:id', handler: async () => NoContent() });

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
        router.post({ path: '/items', handler: async () => Ok({}) });

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
        router.get({ path: '/items', handler: async () => Ok({}) });

        const event = createMockEvent({
          method: 'OPTIONS',
          path: '/items',
          headers: { origin: 'https://example.com' },
        });
        const context = createMockContext();
        const result = await router.handleEvent(event, context);

        expect(result.headers?.['Access-Control-Allow-Credentials']).toBe('true');
      });
    });

    suite('actual requests', () => {
      test('adds CORS headers to successful response', async () => {
        const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
        router.get({ path: '/items', handler: async () => Ok({ data: 'test' }) });

        const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
        const context = createMockContext();
        const result = await router.handleEvent(event, context);

        expect(result.statusCode).toBe(200);
        expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      });

      test('adds CORS headers to 404 response', async () => {
        const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
        router.get({ path: '/items', handler: async () => Ok({}) });

        const event = createMockEvent({ path: '/unknown', headers: { origin: 'https://example.com' } });
        const context = createMockContext();
        const result = await router.handleEvent(event, context);

        expect(result.statusCode).toBe(404);
        expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      });

      test('adds CORS headers to error responses from thrown errors', async () => {
        const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
        router.get({
          path: '/items',
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
          path: '/items',
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
          path: '/items',
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
        router.get({ path: '/items', handler: async () => Ok({ data: 'test' }) });

        const event = createMockEvent({ path: '/items', headers: { origin: 'https://denied.com' } });
        const context = createMockContext();
        const result = await router.handleEvent(event, context);

        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({ Vary: 'Origin' });
      });

      test('includes Vary: Origin for non-wildcard origins', async () => {
        const router = new HTTPRouter({
          adapter: mockAdapter,
          cors: { origin: ['https://example.com'] },
        });
        router.get({ path: '/items', handler: async () => Ok({}) });

        const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
        const context = createMockContext();
        const result = await router.handleEvent(event, context);

        expect(result.headers?.Vary).toBe('Origin');
      });

      test('adds CORS headers to validation failure (422) response', async () => {
        const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });
        const router = new HTTPRouter({ adapter: mockAdapter, cors: { origin: '*' } });
        router.post({ path: '/items', handler: async () => Ok({}), bodySchema });

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
          path: '/items',
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
        router.get({ path: '/items', handler: async () => Ok({}) });

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
        router.get({ path: '/items', handler: async () => Ok({}) });

        const event = createMockEvent({ path: '/items' });
        const context = createMockContext();
        const result = await router.handleEvent(event, context);

        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({ Vary: 'Origin' });
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
        router.get({ path: '/items', handler: async () => Ok({}) });

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
        router.get({ path: '/items', handler: async () => Ok({}) });

        const event = createMockEvent({ path: '/items', headers: { origin: 'https://denied.com' } });
        const context = createMockContext();
        const result = await router.handleEvent(event, context);

        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({ Vary: 'Origin' });
      });

      test('includes credentials on actual response', async () => {
        const router = new HTTPRouter({
          adapter: mockAdapter,
          cors: { origin: ['https://example.com'], credentials: true },
        });
        router.get({ path: '/items', handler: async () => Ok({}) });

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
        router.get({ path: '/items', handler: async () => Ok({}) });

        const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
        const context = createMockContext();
        const result = await router.handleEvent(event, context);

        expect(result.headers?.['Access-Control-Expose-Headers']).toBe('X-Request-Id');
      });
    });

    suite('CORS configuration validation', () => {
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

    suite('no CORS configured', () => {
      test('does not add CORS headers when cors is not configured', async () => {
        router.get({ path: '/items', handler: async () => Ok({ data: 'test' }) });

        const event = createMockEvent({ path: '/items', headers: { origin: 'https://example.com' } });
        const context = createMockContext();
        const result = await router.handleEvent(event, context);

        expect(result.statusCode).toBe(200);
        expect(result.headers).toBeUndefined();
      });

      test('does not handle OPTIONS preflight when cors is not configured', async () => {
        router.get({ path: '/items', handler: async () => Ok({}) });

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
});
