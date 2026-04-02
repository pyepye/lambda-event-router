import { type ApiRequest, type ApiResponse, defineRoute, NoContent, Ok } from '@lambda-event-router/http';
import { createApiGatewayV2Event, createMockSchema, test } from '@lambda-event-router/testing';
import { APIGatewayRouter, createAPIGatewayRouter } from './APIGatewayRouter.js';

type HTTPNext = (request: ApiRequest) => Promise<ApiResponse>;
type NoBodyRequest = ApiRequest<Record<string, string>, Record<string, string | undefined>, undefined>;
type NoBodyNext = (request: NoBodyRequest) => Promise<ApiResponse>;

suite('APIGatewayRouter', () => {
  let router: APIGatewayRouter;

  beforeEach(() => {
    router = new APIGatewayRouter();
  });

  suite('createAPIGatewayRouter', () => {
    test('creates an APIGatewayRouter instance', () => {
      const router = createAPIGatewayRouter();
      expect(router).toBeInstanceOf(APIGatewayRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid API Gateway V2 event', () => {
      const event = createApiGatewayV2Event();
      expect(router.canHandleEvent(event)).toBe(true);
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

    test('returns false when rawPath is missing', () => {
      const event = { requestContext: { http: { method: 'GET' } } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when rawPath is not a string', () => {
      const event = { rawPath: 123, requestContext: { http: { method: 'GET' } } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext is missing', () => {
      const event = { rawPath: '/items' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext is not an object', () => {
      const event = { rawPath: '/items', requestContext: 'bad' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext.http is missing', () => {
      const event = { rawPath: '/items', requestContext: {} };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext.http is not an object', () => {
      const event = { rawPath: '/items', requestContext: { http: 'bad' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when http.method is missing', () => {
      const event = { rawPath: '/items', requestContext: { http: {} } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when http.method is not a string', () => {
      const event = { rawPath: '/items', requestContext: { http: { method: 123 } } };
      expect(router.canHandleEvent(event)).toBe(false);
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
    test('calls the matched handler and returns a response with statusCode and body', async ({
      apiGatewayV2HandlerEvent,
    }) => {
      router.get({
        path: '/',
        handler: async () => Ok({ message: 'hello' }),
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
    });

    test('returns 404 when no route matches', async ({ apiGatewayV2HandlerEvent }) => {
      router.get({ path: '/items', handler: async () => Ok({}) });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/unknown' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not found' }),
        }),
      );
    });

    // test('catches a thrown HTTPResponse and returns it as the response', async ({ apiGatewayV2HandlerEvent }) => {
    //   router.get({
    //     path: '/',
    //     handler: async () => {
    //       throw Response.Unauthorised();
    //     },
    //   });

    //   const { event, context } = apiGatewayV2HandlerEvent();
    //   const result = await router.handleEvent(event, context);

    //   expect(result).toEqual(
    //     expect.objectContaining({
    //       statusCode: 401,
    //       body: JSON.stringify({ error: 'Unauthorised' }),
    //     }),
    //   );
    // });

    test('catches a generic Error and returns 500 with the error message', async ({ apiGatewayV2HandlerEvent }) => {
      router.get({
        path: '/',
        handler: async () => {
          throw new Error('something broke');
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'something broke' }),
        }),
      );
    });

    test('catches a non-Error throw and returns 500 with default message', async ({ apiGatewayV2HandlerEvent }) => {
      router.get({
        path: '/',
        handler: async () => {
          throw 'string error';
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        }),
      );
    });

    test('validates the request before calling handler and returns 422 for body schema failure', async ({
      apiGatewayV2HandlerEvent,
    }) => {
      const handler = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });
      router.post({ path: '/', handler, bodySchema });

      const { event, context } = apiGatewayV2HandlerEvent({
        event: { body: { bad: 'data' }, requestContext: { http: { method: 'POST' } } },
      });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 422,
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('passes extracted path params to the handler', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ found: true }));
      router.get({ path: '/items/:id', handler });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/items/42' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: { id: '42' } }));
    });

    test('passes query params to the handler', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ items: [] }));
      router.get({ path: '/items', handler });

      const { event, context } = apiGatewayV2HandlerEvent({
        event: { rawPath: '/items', queryStringParameters: { page: '2', limit: '10' } },
      });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ query: { page: '2', limit: '10' } }));
    });

    test('passes parsed body to the handler', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ id: 'new-1' }));
      router.post({ path: '/items', handler });

      const { event, context } = apiGatewayV2HandlerEvent({
        event: {
          rawPath: '/items',
          requestContext: { http: { method: 'POST' } },
          body: { name: 'test-item' },
        },
      });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { name: 'test-item' } }));
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ apiGatewayV2HandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: ApiRequest, next: HTTPNext): Promise<ApiResponse> {
        callOrder.push('mw-pre');
        const response = await next(request);
        callOrder.push('mw-post');
        return response;
      }

      const router = createAPIGatewayRouter({ middleware: [middleware] });
      router.get({
        path: '/',
        handler: async () => {
          callOrder.push('handler');
          return Ok({ message: 'hello' });
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to modify the response', async ({ apiGatewayV2HandlerEvent }) => {
      async function addCorsHeaders(request: ApiRequest, next: HTTPNext): Promise<ApiResponse> {
        const response = await next(request);
        return {
          ...response,
          headers: { ...response.headers, 'Access-Control-Allow-Origin': '*' },
        };
      }

      const router = createAPIGatewayRouter({ middleware: [addCorsHeaders] });
      router.get({ path: '/', handler: async () => Ok({ message: 'hello' }) });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          headers: expect.objectContaining({ 'Access-Control-Allow-Origin': '*' }),
        }),
      );
    });

    test('allows middleware to short-circuit with an early response', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({}));

      async function authMiddleware(_request: ApiRequest, _next: HTTPNext): Promise<ApiResponse> {
        return { statusCode: 401, body: null };
      }

      const router = createAPIGatewayRouter({ middleware: [authMiddleware] });
      router.get({ path: '/', handler });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 401 }));
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ apiGatewayV2HandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: ApiRequest, next: HTTPNext): Promise<ApiResponse> {
        callOrder.push('mw1');
        return next(request);
      }

      async function middlewareTwo(request: ApiRequest, next: HTTPNext): Promise<ApiResponse> {
        callOrder.push('mw2');
        return next(request);
      }

      const router = createAPIGatewayRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.get({
        path: '/',
        handler: async () => {
          callOrder.push('handler');
          return Ok({});
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ apiGatewayV2HandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: NoBodyRequest, next: NoBodyNext): Promise<ApiResponse> {
        callOrder.push('route-mw');
        return next(request);
      }

      const router = new APIGatewayRouter();
      router.get({
        path: '/',
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return Ok({});
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('does not apply route middleware to other routes', async ({ apiGatewayV2HandlerEvent }) => {
      const routeMiddleware = vi
        .fn()
        .mockImplementation(async (request: NoBodyRequest, next: (request: NoBodyRequest) => Promise<ApiResponse>) =>
          next(request),
        );

      const router = new APIGatewayRouter();
      router.get({
        path: '/with-mw',
        middleware: [routeMiddleware],
        handler: async () => Ok({}),
      });
      router.get({
        path: '/without-mw',
        handler: async () => Ok({}),
      });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/without-mw' } });
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
    });

    test('supports middleware on defineRoute builder pattern', async ({ apiGatewayV2HandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(
        request: ApiRequest<Record<string, never>, Record<string, string | undefined>, unknown>,
        next: (
          request: ApiRequest<Record<string, never>, Record<string, string | undefined>, unknown>,
        ) => Promise<ApiResponse<unknown>>,
      ): Promise<ApiResponse<unknown>> {
        callOrder.push('route-mw');
        return next(request);
      }

      const route = defineRoute({
        method: 'GET',
        path: '/',
        middleware: [routeMiddleware],
      }).handle(async () => {
        callOrder.push('handler');
        return Ok(null);
      });

      const router = new APIGatewayRouter();
      router.route(route);

      const { event, context } = apiGatewayV2HandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ apiGatewayV2HandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: ApiRequest, next: HTTPNext): Promise<ApiResponse> {
        callOrder.push('router-mw');
        return next(request);
      }

      async function routeMiddleware(request: NoBodyRequest, next: NoBodyNext): Promise<ApiResponse> {
        callOrder.push('route-mw');
        return next(request);
      }

      const router = createAPIGatewayRouter({ middleware: [routerMiddleware] });
      router.get({
        path: '/',
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return Ok({});
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware can short-circuit before route middleware runs', async ({ apiGatewayV2HandlerEvent }) => {
      const routeMiddleware = vi
        .fn()
        .mockImplementation(async (request: ApiRequest, next: (request: ApiRequest) => Promise<ApiResponse>) =>
          next(request),
        );
      const handler = vi.fn().mockResolvedValue(Ok({}));

      async function blockingMiddleware(_request: ApiRequest, _next: HTTPNext): Promise<ApiResponse> {
        return { statusCode: 403, body: null };
      }

      const router = createAPIGatewayRouter({ middleware: [blockingMiddleware] });
      router.get({ path: '/', middleware: [routeMiddleware], handler });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 403 }));
      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run for unmatched routes', () => {
    test('returns 404 without running middleware when no route matches', async ({ apiGatewayV2HandlerEvent }) => {
      const middleware = vi.fn();

      const router = createAPIGatewayRouter({ middleware: [middleware] });
      router.get({ path: '/items', handler: async () => Ok({}) });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/unknown' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 404 }));
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});
