import { type ErrorInput, Forbidden, HTTPException, Html, NoContent, Ok, Response, Unauthorized } from '@latcher/http';
import { allEventBuilders, createApiGatewayV2Event, createMockSchema, test } from '@latcher/testing';

import { APIGatewayMatcher, createAPIGatewayMatcher, defineRoute } from './APIGatewayMatcher.js';
import type { HTTPMiddleware } from './types.js';

suite('APIGatewayMatcher', () => {
  let matcher: APIGatewayMatcher;

  beforeEach(() => {
    matcher = new APIGatewayMatcher();
  });

  suite('createAPIGatewayMatcher', () => {
    test('creates an APIGatewayMatcher instance', () => {
      const matcher = createAPIGatewayMatcher();
      expect(matcher).toBeInstanceOf(APIGatewayMatcher);
    });
  });

  suite('cors', () => {
    test('answers an OPTIONS preflight when cors is configured', async ({ apiGatewayV2HandlerEvent }) => {
      const corsMatcher = createAPIGatewayMatcher({ cors: { origin: 'https://app.example.com' } });
      corsMatcher.get({ filters: { path: '/items' }, handler: async () => Ok({}) });
      corsMatcher.post({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = apiGatewayV2HandlerEvent({
        event: {
          rawPath: '/items',
          requestContext: { http: { method: 'OPTIONS' } },
          headers: { origin: 'https://app.example.com' },
        },
      });
      const result = await corsMatcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 204,
          headers: expect.objectContaining({
            'Access-Control-Allow-Origin': 'https://app.example.com',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          }),
        }),
      );
    });

    test('adds cors headers to a handler response', async ({ apiGatewayV2HandlerEvent }) => {
      const corsMatcher = createAPIGatewayMatcher({ cors: { origin: '*' } });
      corsMatcher.get({ filters: { path: '/items' }, handler: async () => Ok({ data: 'test' }) });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/items' } });
      const result = await corsMatcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          headers: expect.objectContaining({ 'Access-Control-Allow-Origin': '*' }),
        }),
      );
    });

    test('throws when credentials is combined with a wildcard origin', () => {
      expect(() => createAPIGatewayMatcher({ cors: { origin: '*', credentials: true } })).toThrow(
        'CORS configuration error: credentials cannot be used with wildcard (*) origin',
      );
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid API Gateway V2 event', () => {
      const event = createApiGatewayV2Event();
      expect(matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(matcher.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(matcher.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for a number', () => {
      expect(matcher.canHandleEvent(42)).toBe(false);
    });

    test('returns false for an array', () => {
      expect(matcher.canHandleEvent([1, 2, 3])).toBe(false);
    });

    test('returns false when rawPath is missing', () => {
      const event = { requestContext: { http: { method: 'GET' } } };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when rawPath is not a string', () => {
      const event = { rawPath: 123, requestContext: { http: { method: 'GET' } } };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext is missing', () => {
      const event = { rawPath: '/items' };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext is not an object', () => {
      const event = { rawPath: '/items', requestContext: 'bad' };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext.http is missing', () => {
      const event = { rawPath: '/items', requestContext: {} };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext.http is not an object', () => {
      const event = { rawPath: '/items', requestContext: { http: 'bad' } };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when http.method is missing', () => {
      const event = { rawPath: '/items', requestContext: { http: {} } };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when http.method is not a string', () => {
      const event = { rawPath: '/items', requestContext: { http: { method: 123 } } };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });
  });

  suite('route', () => {
    test('returns the matcher instance for chaining', () => {
      const definition = defineRoute({
        filters: {
          method: 'GET',
          path: '/items',
        },
      }).handle(async () => NoContent());

      const result = matcher.route(definition);

      expect(result).toBe(matcher);
    });
  });

  suite('HTTP method chaining', () => {
    test.each([
      { method: 'get' as const, path: '/items', handler: async () => Ok({ items: [] }) },
      { method: 'post' as const, path: '/items', handler: async () => Ok({ id: '1' }) },
      { method: 'put' as const, path: '/items/:id', handler: async () => Ok({ updated: true }) },
      { method: 'patch' as const, path: '/items/:id', handler: async () => Ok({ patched: true }) },
      { method: 'delete' as const, path: '/items/:id', handler: async () => NoContent() },
    ])('$method returns the matcher instance for chaining', ({ method, path, handler }) => {
      // @ts-expect-error - calling union of method signatures
      const result = matcher[method]({ filters: { path }, handler });

      expect(result).toBe(matcher);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: {
          method: 'GET',
          path: '/items',
        },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves all schemas and handler in the definition', () => {
      const querySchema = createMockSchema();
      const bodySchema = createMockSchema();
      const responseSchema = createMockSchema<{ itemId: string }>();
      const handler = vi.fn();

      const definition = defineRoute({
        filters: {
          method: 'POST',
          path: '/items/:id',
        },
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
    test('calls the matched handler and returns a response with statusCode and body', async ({
      apiGatewayV2HandlerEvent,
    }) => {
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => Ok({ message: 'hello' }),
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
    });

    test('returns 404 when no route matches', async ({ apiGatewayV2HandlerEvent }) => {
      matcher.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/unknown' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not Found' }),
        }),
      );
    });

    test('catches a thrown HTTPResponse and returns it as the response', async ({ apiGatewayV2HandlerEvent }) => {
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          throw Response.Unauthorized();
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 401,
          body: JSON.stringify({ error: 'Unauthorized' }),
        }),
      );
    });

    test('hides the message of an unhandled error', async ({ apiGatewayV2HandlerEvent }) => {
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          throw new Error('something broke');
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );
    });

    test('catches a non-Error throw and returns 500 with default message', async ({ apiGatewayV2HandlerEvent }) => {
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          throw 'string error';
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );
    });

    test('validates the request before calling handler and returns 422 for body schema failure', async ({
      apiGatewayV2HandlerEvent,
    }) => {
      const handler = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });
      matcher.post({ filters: { path: '/' }, handler, bodySchema });

      const { event, context } = apiGatewayV2HandlerEvent({
        event: { body: { bad: 'data' }, requestContext: { http: { method: 'POST' } } },
      });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 422,
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('passes extracted path params to the handler', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ found: true }));
      matcher.get({ filters: { path: '/items/:id' }, handler });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/items/42' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: { id: '42' } }));
    });

    test('passes query params to the handler', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ items: [] }));
      matcher.get({ filters: { path: '/items' }, handler });

      const { event, context } = apiGatewayV2HandlerEvent({
        event: { rawPath: '/items', queryStringParameters: { page: '2', limit: '10' } },
      });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ query: { page: '2', limit: '10' } }));
    });

    test('gives a bare HTTPMiddleware the output of the querySchema', async ({ apiGatewayV2HandlerEvent }) => {
      let receivedQuery: unknown;
      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const readsQuery: HTTPMiddleware = async (request, next) => {
        receivedQuery = request.query;
        return next(request);
      };
      matcher.get({
        filters: { path: '/items' },
        querySchema: createMockSchema({ value: { limit: 10 } }),
        middleware: [readsQuery],
        handler: async () => NoContent(),
      });

      const { event, context } = apiGatewayV2HandlerEvent({
        event: { rawPath: '/items', queryStringParameters: { limit: '10' } },
      });
      await matcher.handleEvent(event, context);

      expect(receivedQuery).toEqual({ limit: 10 });
    });

    test('passes parsed body to the handler', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ id: 'new-1' }));
      matcher.post({ filters: { path: '/items' }, handler });

      const { event, context } = apiGatewayV2HandlerEvent({
        event: {
          rawPath: '/items',
          requestContext: { http: { method: 'POST' } },
          body: { name: 'test-item' },
        },
      });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { name: 'test-item' } }));
    });
  });

  suite('matcher-level middleware', () => {
    test('executes middleware before the route handler', async ({ apiGatewayV2HandlerEvent }) => {
      const callOrder: string[] = [];

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const middleware: HTTPMiddleware = async (request, next) => {
        callOrder.push('mw-pre');
        const response = await next(request);
        callOrder.push('mw-post');
        return response;
      };

      const matcher = createAPIGatewayMatcher({ middleware: [middleware] });
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          callOrder.push('handler');
          return Ok({ message: 'hello' });
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to modify the response', async ({ apiGatewayV2HandlerEvent }) => {
      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const addCorsHeaders: HTTPMiddleware = async (request, next) => {
        const handlerResponse = await next(request);
        if (handlerResponse instanceof HTTPException) return handlerResponse;
        const response = Response.isHTTPResponse(handlerResponse) ? handlerResponse : Ok(handlerResponse);
        return {
          ...response,
          headers: { ...response.headers, 'Access-Control-Allow-Origin': '*' },
        };
      };

      const matcher = createAPIGatewayMatcher({ middleware: [addCorsHeaders] });
      matcher.get({ filters: { path: '/' }, handler: async () => Ok({ message: 'hello' }) });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          headers: expect.objectContaining({ 'Access-Control-Allow-Origin': '*' }),
        }),
      );
    });

    test('allows middleware to short-circuit with an early response', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({}));

      const authMiddleware: HTTPMiddleware = async () => {
        return Unauthorized();
      };

      const matcher = createAPIGatewayMatcher({ middleware: [authMiddleware] });
      matcher.get({ filters: { path: '/' }, handler });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 401 }));
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple matcher-level middleware in order', async ({ apiGatewayV2HandlerEvent }) => {
      const callOrder: string[] = [];

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const middlewareOne: HTTPMiddleware = async (request, next) => {
        callOrder.push('mw1');
        return next(request);
      };

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const middlewareTwo: HTTPMiddleware = async (request, next) => {
        callOrder.push('mw2');
        return next(request);
      };

      const matcher = createAPIGatewayMatcher({ middleware: [middlewareOne, middlewareTwo] });
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          callOrder.push('handler');
          return Ok({});
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ apiGatewayV2HandlerEvent }) => {
      const callOrder: string[] = [];

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const routeMiddleware: HTTPMiddleware = async (request, next) => {
        callOrder.push('route-mw');
        return next(request);
      };

      matcher.get({
        filters: {
          path: '/',
        },
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return Ok({});
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({}));

      const blockingRouteMiddleware: HTTPMiddleware = async () => {
        return Forbidden();
      };

      matcher.get({
        filters: {
          path: '/',
        },
        middleware: [blockingRouteMiddleware],
        handler,
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 403 }));
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ apiGatewayV2HandlerEvent }) => {
      const callOrder: string[] = [];

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const routeMiddlewareOne: HTTPMiddleware = async (request, next) => {
        callOrder.push('route-mw1');
        return next(request);
      };

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const routeMiddlewareTwo: HTTPMiddleware = async (request, next) => {
        callOrder.push('route-mw2');
        return next(request);
      };

      matcher.get({
        filters: {
          path: '/',
        },
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
          return Ok({});
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('does not apply route middleware to other routes', async ({ apiGatewayV2HandlerEvent }) => {
      const routeMiddleware = vi.fn();

      matcher.get({
        filters: {
          path: '/with-mw',
        },
        middleware: [routeMiddleware],
        handler: async () => Ok({}),
      });
      matcher.get({
        filters: {
          path: '/without-mw',
        },
        handler: async () => Ok({}),
      });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/without-mw' } });
      await matcher.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
    });

    test('supports middleware on defineRoute builder pattern', async ({ apiGatewayV2HandlerEvent }) => {
      const callOrder: string[] = [];

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const routeMiddleware: HTTPMiddleware = async (request, next) => {
        callOrder.push('route-mw');
        return next(request);
      };

      const route = defineRoute({
        filters: {
          method: 'GET',
          path: '/',
        },
        middleware: [routeMiddleware],
      }).handle(async () => {
        callOrder.push('handler');
        return Ok(null);
      });

      matcher.route(route);

      const { event, context } = apiGatewayV2HandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined matcher and route middleware', () => {
    test('executes matcher middleware before route middleware', async ({ apiGatewayV2HandlerEvent }) => {
      const callOrder: string[] = [];

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const matcherMiddleware: HTTPMiddleware = async (request, next) => {
        callOrder.push('matcher-mw');
        return next(request);
      };

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const routeMiddleware: HTTPMiddleware = async (request, next) => {
        callOrder.push('route-mw');
        return next(request);
      };

      const matcher = createAPIGatewayMatcher({ middleware: [matcherMiddleware] });
      matcher.get({
        filters: {
          path: '/',
        },
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return Ok({});
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });

    test('matcher middleware can short-circuit before route middleware runs', async ({ apiGatewayV2HandlerEvent }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn().mockResolvedValue(Ok({}));

      const blockingMiddleware: HTTPMiddleware = async () => {
        return Forbidden();
      };

      const matcher = createAPIGatewayMatcher({ middleware: [blockingMiddleware] });
      matcher.get({ filters: { path: '/' }, middleware: [routeMiddleware], handler });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 403 }));
      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when body schema validation fails', async ({ apiGatewayV2HandlerEvent }) => {
      const middleware = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });

      const matcher = createAPIGatewayMatcher({ middleware: [middleware] });
      matcher.post({ filters: { path: '/' }, handler: async () => Ok({}), bodySchema });

      const { event, context } = apiGatewayV2HandlerEvent({
        event: { body: { bad: 'data' }, requestContext: { http: { method: 'POST' } } },
      });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 422 }));
      expect(middleware).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run for unmatched routes', () => {
    test('returns 404 without running middleware when no route matches', async ({ apiGatewayV2HandlerEvent }) => {
      const middleware = vi.fn();

      const matcher = createAPIGatewayMatcher({ middleware: [middleware] });
      matcher.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/unknown' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 404 }));
      expect(middleware).not.toHaveBeenCalled();
    });
  });

  suite('handleEvent - custom', () => {
    test('matches route when custom returns true', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn(async () => Ok({ message: 'hello' }));
      matcher.get({
        filters: { path: '/items', custom: () => true },
        handler,
      });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/items' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
      expect(handler).toHaveBeenCalledOnce();
    });

    test('returns 404 when custom returns false', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn(async () => Ok({}));
      matcher.get({
        filters: { path: '/items', custom: () => false },
        handler,
      });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/items' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not Found' }),
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('matches route when custom is async and resolves true', async ({ apiGatewayV2HandlerEvent }) => {
      matcher.get({
        filters: {
          path: '/items',
          custom: async () => {
            await new Promise((r) => setTimeout(r, 1));
            return true;
          },
        },
        handler: async () => Ok({ message: 'hello' }),
      });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/items' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
    });
  });
});

suite('APIGatewayMatcher.canHandleEvent', () => {
  const ownEvents = [
    'createApiGatewayV1Event',
    'createApiGatewayV2Event',
    'createApiGatewayV2WithIAMAuthorizerEvent',
    'createApiGatewayV2WithJWTAuthorizerEvent',
    'createApiGatewayV2WithLambdaAuthorizerEvent',
  ];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createAPIGatewayMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
  suite('response types', () => {
    const errors = {
      html: ({ statusCode, statusText }: ErrorInput): Html => Html(`<h1>${statusCode} ${statusText}</h1>`),
    };

    test('sends Html and error pages from an HTML matcher', async ({ apiGatewayV2HandlerEvent }) => {
      const htmlMatcher = new APIGatewayMatcher({ responseType: 'html', errors });
      htmlMatcher.get({ filters: { path: '/orders' }, handler: async () => Html('<p>Orders</p>') });

      const page = apiGatewayV2HandlerEvent({ event: { rawPath: '/orders' } });
      const missing = apiGatewayV2HandlerEvent({ event: { rawPath: '/missing' } });
      const pageResult = await htmlMatcher.handleEvent(page.event, page.context);
      const missingResult = await htmlMatcher.handleEvent(missing.event, missing.context);

      expect(pageResult).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: '<p>Orders</p>',
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      );
      expect(missingResult).toEqual(expect.objectContaining({ statusCode: 404, body: '<h1>404 Not Found</h1>' }));
    });

    test('accepts an inline errors.html whose parameters are inferred', () => {
      expect(
        () =>
          new APIGatewayMatcher({
            responseType: 'html',
            // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
            errors: { html: ({ statusCode }) => Html(`<h1>${statusCode}</h1>`) },
          }),
      ).not.toThrow();
      expect(() =>
        createAPIGatewayMatcher({
          responseType: 'html',
          // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
          errors: { html: ({ statusCode }) => Html(`<h1>${statusCode}</h1>`) },
        }),
      ).not.toThrow();
    });

    test('rejects an HTML matcher with no errors.html', () => {
      // @ts-expect-error - an HTML matcher needs errors.html
      expect(() => new APIGatewayMatcher({ responseType: 'html' })).toThrow(
        'Response type configuration error: an HTML matcher needs errors.html',
      );
    });
  });
});
