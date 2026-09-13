import type { MockInstance } from 'vitest';

import * as base from '@lambda-event-router/base';
import { createMockContext, createMockSchema } from '@lambda-event-router/testing';

import { BinaryBody } from './binaryBody.js';
import { HTTPException } from './HTTPException.js';
import { defineRoute, HTTPRouter } from './HTTPRouter.js';
import { Html } from './html.js';
import { Conflict, Created, Forbidden, NoContent, NotFound, Ok, TemporaryRedirect, Unauthorized } from './Response.js';
import type {
  ApiRequest,
  ErrorInput,
  FinalizedHTTPResponse,
  HandlerResponse,
  HTTPAdapter,
  HTTPMiddleware,
  NormalizedHTTPEvent,
} from './types.js';

const validateSchemaResultSpy: MockInstance = vi.spyOn(base, 'validateSchemaResult');
const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');

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
  isBase64Encoded: boolean;
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
      multiValueHeaders: {},
      query: event.query ?? {},
      multiValueQuery: {},
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
      isBase64Encoded: response.isBase64Encoded,
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
      const middlewareSpy = vi.fn();
      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const middleware: HTTPMiddleware = async (request, next) => {
        middlewareSpy();
        return next(request);
      };
      const optionsRouter = new HTTPRouter({ adapter: mockAdapter, middleware: [middleware] });
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
      const result = await router.handleEvent(
        createMockEvent({ method: 'HEAD', path: '/missing' }),
        createMockContext(),
      );

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
      const responseSchema = createMockSchema<{ itemId: string }>();
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
          body: JSON.stringify({ error: 'Not Found' }),
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

    test('hides the message of an unhandled error and logs it', async () => {
      const errorSpy = vi.spyOn(base.getLogger(), 'error').mockImplementation(() => undefined);
      const error = new Error('connection to orders-db.internal:5432 refused');
      router.get({ filters: { path: '/' }, handler: vi.fn().mockRejectedValue(error) });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({ statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) }),
      );
      expect(errorSpy).toHaveBeenCalledWith('Unhandled error processing HTTP request', { error });
      errorSpy.mockRestore();
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
          body: JSON.stringify({ error: 'Internal Server Error' }),
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
      const middlewareSpy = vi.fn();
      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const middleware: HTTPMiddleware = async (request, next) => {
        middlewareSpy();
        return next(request);
      };
      const route = defineRoute({
        filters: { method: 'GET', path: '/items' },
        middleware: [middleware],
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

  suite('handleEvent - binary bodies', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    test('hands the handler the bytes of a base64 body its content type says are not text', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({}));
      router.post({ filters: { path: '/labels' }, handler });

      const event = createMockEvent({
        method: 'POST',
        path: '/labels',
        headers: { 'content-type': 'image/png' },
        body: png.toString('base64'),
        isBase64Encoded: true,
      });
      await router.handleEvent(event, createMockContext());

      const request = handler.mock.calls[0]?.[0] as ApiRequest;
      expect(request.body).toEqual(png);
      expect(request.rawBody).toBe(png.toString('base64'));
      expect(request.isBase64Encoded).toBe(true);
    });

    test('base64 encodes a handler that answers with bytes', async () => {
      router.get({ filters: { path: '/labels/1' }, responseType: 'binary', handler: async () => png });

      const result = await router.handleEvent(createMockEvent({ path: '/labels/1' }), createMockContext());

      expect(result).toEqual({
        statusCode: 200,
        body: png.toString('base64'),
        headers: { 'content-type': 'application/octet-stream' },
        isBase64Encoded: true,
      });
    });

    test('keeps the content type a handler sets on its bytes', async () => {
      router.get({
        filters: { path: '/labels/2' },
        responseType: 'binary',
        handler: async () => Ok(png, { 'content-type': 'image/png' }),
      });

      const result = await router.handleEvent(createMockEvent({ path: '/labels/2' }), createMockContext());

      expect(result.headers).toEqual({ 'content-type': 'image/png' });
      expect(result.isBase64Encoded).toBe(true);
    });

    test('types a route that takes bytes and refuses a caller that sends text', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({}));
      router.put({ filters: { path: '/labels/4' }, bodySchema: BinaryBody, handler });

      const event = createMockEvent({
        method: 'PUT',
        path: '/labels/4',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku: 'brk-9' }),
      });
      const result = await router.handleEvent(event, createMockContext());

      expect(result.statusCode).toBe(422);
      expect(result.body).toContain('Expected a binary body, got an object');
      expect(handler).not.toHaveBeenCalled();
    });

    test('hands a route that takes bytes the buffer the caller sent', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({}));
      router.put({ filters: { path: '/labels/5' }, bodySchema: BinaryBody, handler });

      const event = createMockEvent({
        method: 'PUT',
        path: '/labels/5',
        headers: { 'content-type': 'image/png' },
        body: png.toString('base64'),
        isBase64Encoded: true,
      });
      await router.handleEvent(event, createMockContext());

      expect(handler.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ body: png }));
    });

    test('leaves a text response unencoded', async () => {
      router.get({ filters: { path: '/labels/3' }, handler: async () => Ok({ ok: true }) });

      const result = await router.handleEvent(createMockEvent({ path: '/labels/3' }), createMockContext());

      expect(result.isBase64Encoded).toBe(false);
    });
  });

  suite('handleEvent - JSON bodies', () => {
    let errorSpy: MockInstance;

    beforeEach(() => {
      errorSpy = vi.spyOn(base.getLogger(), 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    test('sends a string on a JSON route as a JSON string', async () => {
      router.get({ filters: { path: '/' }, handler: vi.fn().mockResolvedValue('ok') });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual({
        statusCode: 200,
        body: '"ok"',
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('answers 500 and logs for a function body', async () => {
      router.get({ filters: { path: '/' }, handler: vi.fn().mockResolvedValue(() => {}) });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
      expect(errorSpy).toHaveBeenCalledWith('Response body cannot be sent as JSON', { bodyType: 'function' });
    });

    test('answers 500 and logs for a circular body', async () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      router.get({ filters: { path: '/' }, handler: vi.fn().mockResolvedValue(Ok(circular)) });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({ statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) }),
      );
      expect(errorSpy).toHaveBeenCalledOnce();
    });

    test('answers a JSON 500 and logs for a thrown error whose context is not JSON', async () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      router.get({ filters: { path: '/' }, handler: vi.fn().mockRejectedValue(NotFound(undefined, circular)) });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });

  suite('handleEvent - response types', () => {
    const errorPage = ({ statusCode, statusText, message }: ErrorInput): Html =>
      Html(`<h1>${statusCode} ${statusText}</h1><p>${message}</p>`);

    test('sends Html from an HTML route', async () => {
      const htmlRouter = new HTTPRouter({ adapter: mockAdapter, responseType: 'html', errors: { html: errorPage } });
      htmlRouter.get({ filters: { path: '/' }, handler: async () => Html('<p>Order ord-1</p>') });

      const result = await htmlRouter.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual({
        statusCode: 200,
        body: '<p>Order ord-1</p>',
        headers: { 'content-type': 'text/html; charset=utf-8' },
        isBase64Encoded: false,
      });
    });

    test('awaits an Html promise from a handler and from errors.html', async () => {
      const htmlRouter = new HTTPRouter({
        adapter: mockAdapter,
        responseType: 'html',
        errors: { html: async () => Html(Promise.resolve('<h1>Missing</h1>')) },
      });
      htmlRouter.get({ filters: { path: '/' }, handler: () => Html(Promise.resolve('<p>Order ord-1</p>')) });

      const page = await htmlRouter.handleEvent(createMockEvent(), createMockContext());
      const missing = await htmlRouter.handleEvent(createMockEvent({ path: '/missing' }), createMockContext());

      expect(page.body).toBe('<p>Order ord-1</p>');
      expect(missing).toEqual(expect.objectContaining({ statusCode: 404, body: '<h1>Missing</h1>' }));
    });

    test("sends a string from a text route with the route's content type", async () => {
      router.get({
        filters: { path: '/returns.csv' },
        responseType: { type: 'text', contentType: 'text/csv' },
        handler: async () => 'sku,quantity',
      });

      const result = await router.handleEvent(createMockEvent({ path: '/returns.csv' }), createMockContext());

      expect(result).toEqual({
        statusCode: 200,
        body: 'sku,quantity',
        headers: { 'content-type': 'text/csv' },
        isBase64Encoded: false,
      });
    });

    test("uses the router's responseType for a route that sets none", async () => {
      const textRouter = new HTTPRouter({ adapter: mockAdapter, responseType: 'text' });
      textRouter.get({ filters: { path: '/' }, handler: async () => 'ok' });

      const result = await textRouter.handleEvent(createMockEvent(), createMockContext());

      expect(result.headers).toEqual({ 'content-type': 'text/plain; charset=utf-8' });
    });

    test("uses the route's responseType over the router's", async () => {
      const textRouter = new HTTPRouter({ adapter: mockAdapter, responseType: 'text' });
      textRouter.get({ filters: { path: '/' }, responseType: 'json', handler: async () => ({ orderId: 'ord-1' }) });

      const result = await textRouter.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({
          body: JSON.stringify({ orderId: 'ord-1' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    test("gives a route from the router's defineRoute the router's responseType", async () => {
      const textRouter = new HTTPRouter({ adapter: mockAdapter, responseType: 'text' });
      textRouter.route(textRouter.defineRoute({ filters: { method: 'GET', path: '/' } }).handle(async () => 'ok'));

      const result = await textRouter.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({ body: 'ok', headers: { 'content-type': 'text/plain; charset=utf-8' } }),
      );
    });

    test('keeps a standalone route with no responseType as JSON on a text router', async () => {
      const textRouter = new HTTPRouter({ adapter: mockAdapter, responseType: 'text' });
      textRouter.route(
        defineRoute({ filters: { method: 'GET', path: '/' } }).handle(async () => ({ orderId: 'ord-1' })),
      );

      const result = await textRouter.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({
          body: JSON.stringify({ orderId: 'ord-1' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    test('keeps a standalone route with an undefined responseType as JSON on a text router', async () => {
      const textRouter = new HTTPRouter({ adapter: mockAdapter, responseType: 'text' });
      textRouter.route(
        // @ts-expect-error - the types reject an undefined responseType, but JavaScript can still pass one
        defineRoute({ filters: { method: 'GET', path: '/' }, responseType: undefined }).handle(async () => ({
          orderId: 'ord-1',
        })),
      );

      const result = await textRouter.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({
          body: JSON.stringify({ orderId: 'ord-1' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    test('sends bytes from a binary route', async () => {
      const pdf = Buffer.from('%PDF-1.7');
      router.get({
        filters: { path: '/labels/1' },
        responseType: { type: 'binary', contentType: 'application/pdf' },
        handler: async () => pdf,
      });

      const result = await router.handleEvent(createMockEvent({ path: '/labels/1' }), createMockContext());

      expect(result).toEqual({
        statusCode: 200,
        body: pdf.toString('base64'),
        headers: { 'content-type': 'application/pdf' },
        isBase64Encoded: true,
      });
    });

    test('throws on setup for an HTML router with no errors.html', () => {
      // @ts-expect-error - an HTML router needs errors.html
      expect(() => new HTTPRouter({ adapter: mockAdapter, responseType: 'html' })).toThrow(
        'Response type configuration error: an HTML router needs errors.html',
      );
    });

    test('throws on setup for an HTML route on a router with no errors.html', () => {
      const htmlRoute = { filters: { path: '/' }, responseType: 'html', handler: async () => Html('') } as const;

      // @ts-expect-error - an HTML route needs errors.html on its router
      expect(() => router.get(htmlRoute)).toThrow(
        'Response type configuration error: an HTML route needs errors.html on its router',
      );
      // @ts-expect-error - an HTML route needs errors.html on its router
      expect(() => router.route({ ...htmlRoute, filters: { method: 'GET', path: '/' } })).toThrow(
        'Response type configuration error: an HTML route needs errors.html on its router',
      );
    });
  });

  suite('handleEvent - errors', () => {
    const errorPage = ({ statusCode, statusText, message }: ErrorInput): Html =>
      Html(`<h1>${statusCode} ${statusText}</h1><p>${message}</p>`);
    let errorSpy: MockInstance;
    let warnSpy: MockInstance;
    let htmlRouter: HTTPRouter<MockEvent, MockResult, unknown, unknown, 'html', { html: typeof errorPage }>;

    beforeEach(() => {
      errorSpy = vi.spyOn(base.getLogger(), 'error').mockImplementation(() => undefined);
      warnSpy = vi.spyOn(base.getLogger(), 'warn').mockImplementation(() => undefined);
      htmlRouter = new HTTPRouter({ adapter: mockAdapter, responseType: 'html', errors: { html: errorPage } });
    });

    afterEach(() => {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    });

    test('calls errors.html with the status, message and context for a thrown helper', async () => {
      const html = vi.fn(errorPage);
      const pageRouter = new HTTPRouter({ adapter: mockAdapter, responseType: 'html', errors: { html } });
      pageRouter.get({
        filters: { path: '/' },
        handler: vi.fn().mockRejectedValue(NotFound('No order ord-1', { orderId: 'ord-1' })),
      });

      const result = await pageRouter.handleEvent(createMockEvent(), createMockContext());

      expect(html).toHaveBeenCalledWith({
        statusCode: 404,
        statusText: 'Not Found',
        message: 'No order ord-1',
        context: { orderId: 'ord-1' },
      });
      expect(result).toEqual({
        statusCode: 404,
        body: '<h1>404 Not Found</h1><p>No order ord-1</p>',
        headers: { 'content-type': 'text/html; charset=utf-8' },
        isBase64Encoded: false,
      });
    });

    test('calls errors.html for a 404 with no matching route', async () => {
      const result = await htmlRouter.handleEvent(createMockEvent({ path: '/missing' }), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({ statusCode: 404, body: '<h1>404 Not Found</h1><p>Not Found</p>' }),
      );
    });

    test.each([
      { name: 'missing auth', statusCode: 401, reason: 'missing' },
      { name: 'invalid auth', statusCode: 403, reason: 'invalid' },
      { name: 'an auth preset of the wrong type', statusCode: 500, reason: 'wrongType' },
    ] as const)('calls errors.html for $name', async ({ statusCode, reason }) => {
      const auth = {
        name: 'staffOnly',
        check: async () => ({ success: false, reason, message: 'expected staff auth' }) as const,
      };
      htmlRouter.get({ filters: { path: '/' }, auth, handler: async () => Html('') });

      const result = await htmlRouter.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({ statusCode, headers: { 'content-type': 'text/html; charset=utf-8' } }),
      );
      expect(result.body).toMatch(`<h1>${statusCode} `);
    });

    test('calls errors.html for query, body and response schema failures', async () => {
      const failing = createMockSchema({ issues: [{ message: 'Expected a SKU' }] });
      htmlRouter.get({ filters: { path: '/query' }, querySchema: failing, handler: async () => Html('') });
      htmlRouter.post({ filters: { path: '/body' }, bodySchema: failing, handler: async () => Html('') });
      htmlRouter.get({
        filters: { path: '/response' },
        responseSchema: createMockSchema<Html>({ issues: [{ message: 'Expected a page' }] }),
        handler: async () => Html(''),
      });

      const query = await htmlRouter.handleEvent(createMockEvent({ path: '/query' }), createMockContext());
      const body = await htmlRouter.handleEvent(
        createMockEvent({ method: 'POST', path: '/body', body: '{}' }),
        createMockContext(),
      );
      const response = await htmlRouter.handleEvent(createMockEvent({ path: '/response' }), createMockContext());

      expect(query.body).toMatch('<h1>400 Bad Request</h1>');
      expect(body.body).toMatch('<h1>422 Unprocessable Content</h1>');
      expect(response.body).toBe('<h1>500 Internal Server Error</h1><p>Internal Server Error</p>');
    });

    test('sends a statusCode field from errors.json as part of the body', async () => {
      const statusRouter = new HTTPRouter({
        adapter: mockAdapter,
        errors: { json: ({ statusCode, message }: ErrorInput) => ({ statusCode, error: message }) },
      });

      const result = await statusRouter.handleEvent(createMockEvent({ path: '/missing' }), createMockContext());

      expect(result).toEqual({
        statusCode: 404,
        body: JSON.stringify({ statusCode: 404, error: 'Not Found' }),
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('calls errors.json for every error when it is set', async () => {
      const json = vi.fn(({ statusCode, statusText }: ErrorInput) => ({ status: statusCode, title: statusText }));
      const jsonRouter = new HTTPRouter({ adapter: mockAdapter, errors: { json } });
      jsonRouter.get({ filters: { path: '/' }, handler: vi.fn().mockRejectedValue(new Error('boom')) });

      const thrown = await jsonRouter.handleEvent(createMockEvent(), createMockContext());
      const missing = await jsonRouter.handleEvent(createMockEvent({ path: '/missing' }), createMockContext());

      expect(thrown).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ status: 500, title: 'Internal Server Error' }),
        }),
      );
      expect(missing.body).toBe(JSON.stringify({ status: 404, title: 'Not Found' }));
    });

    test('calls errors.text on a text route when it is set', async () => {
      const textRouter = new HTTPRouter({
        adapter: mockAdapter,
        responseType: 'text',
        errors: { text: ({ statusCode }: ErrorInput): string => `error ${statusCode}` },
      });

      const result = await textRouter.handleEvent(createMockEvent({ path: '/missing' }), createMockContext());

      expect(result).toEqual({
        statusCode: 404,
        body: 'error 404',
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        isBase64Encoded: false,
      });
    });

    test('sends only the message on a text route with no errors.text', async () => {
      router.get({
        filters: { path: '/' },
        responseType: 'text',
        handler: vi.fn().mockRejectedValue(Forbidden('Not your order', { orderId: 'ord-1' })),
      });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 403,
          body: 'Not your order',
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
      );
    });

    test('sends the default message on a text route when there is no message', async () => {
      router.get({
        filters: { path: '/' },
        responseType: 'text',
        handler: vi.fn().mockRejectedValue(new HTTPException(429)),
      });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result.body).toBe('Too Many Requests');
    });

    test('sends JSON errors for a JSON route in an HTML router', async () => {
      htmlRouter.get({
        filters: { path: '/api' },
        responseType: 'json',
        handler: vi.fn().mockRejectedValue(NotFound()),
      });

      const result = await htmlRouter.handleEvent(createMockEvent({ path: '/api' }), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({
          body: JSON.stringify({ error: 'Not Found' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    test("uses the router's kind for the errors of a binary route", async () => {
      htmlRouter.get({
        filters: { path: '/labels/1' },
        responseType: 'binary',
        handler: vi.fn().mockRejectedValue(NotFound()),
      });

      const result = await htmlRouter.handleEvent(createMockEvent({ path: '/labels/1' }), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({ statusCode: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }),
      );
    });

    test('uses errors.json for the errors of a binary router', async () => {
      const binaryRouter = new HTTPRouter({ adapter: mockAdapter, responseType: 'binary' });

      const result = await binaryRouter.handleEvent(createMockEvent({ path: '/missing' }), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({
          body: JSON.stringify({ error: 'Not Found' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    test("uses the kind's default content type for an error, not the route's", async () => {
      router.get({
        filters: { path: '/' },
        responseType: { type: 'text', contentType: 'text/csv' },
        handler: vi.fn().mockRejectedValue(NotFound()),
      });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result.headers).toEqual({ 'content-type': 'text/plain; charset=utf-8' });
    });

    test('sends a plain-text 500 and logs when errors.html throws', async () => {
      const error = new Error('Template not found');
      const brokenRouter = new HTTPRouter({
        adapter: mockAdapter,
        responseType: 'html',
        errors: {
          html: () => {
            throw error;
          },
        },
      });

      const result = await brokenRouter.handleEvent(createMockEvent({ path: '/missing' }), createMockContext());

      expect(result).toEqual({
        statusCode: 500,
        body: 'Internal Server Error',
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        isBase64Encoded: false,
      });
      expect(errorSpy).toHaveBeenCalledWith('Error response body could not be built', { statusCode: 404, error });
    });

    test('sends a JSON 500 and logs when errors.json throws', async () => {
      const error = new Error('Error body not built');
      const brokenRouter = new HTTPRouter({
        adapter: mockAdapter,
        errors: {
          json: () => {
            throw error;
          },
        },
      });

      const result = await brokenRouter.handleEvent(createMockEvent({ path: '/missing' }), createMockContext());

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
      expect(errorSpy).toHaveBeenCalledWith('Error response body could not be built', { statusCode: 404, error });
    });

    test('sends a plain-text 500 and logs when errors.text throws', async () => {
      const error = new Error('Error body not built');
      const brokenRouter = new HTTPRouter({
        adapter: mockAdapter,
        responseType: 'text',
        errors: {
          text: () => {
            throw error;
          },
        },
      });

      const result = await brokenRouter.handleEvent(createMockEvent({ path: '/missing' }), createMockContext());

      expect(result).toEqual({
        statusCode: 500,
        body: 'Internal Server Error',
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        isBase64Encoded: false,
      });
      expect(errorSpy).toHaveBeenCalledWith('Error response body could not be built', { statusCode: 404, error });
    });

    test('sends a plain-text 500 and logs on a binary route when errors.json throws', async () => {
      const error = new Error('Error body not built');
      const brokenRouter = new HTTPRouter({
        adapter: mockAdapter,
        errors: {
          json: () => {
            throw error;
          },
        },
      });
      brokenRouter.get({
        filters: { path: '/' },
        responseType: 'binary',
        handler: vi.fn().mockRejectedValue(NotFound()),
      });

      const result = await brokenRouter.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual({
        statusCode: 500,
        body: 'Internal Server Error',
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        isBase64Encoded: false,
      });
      expect(errorSpy).toHaveBeenCalledWith('Error response body could not be built', { statusCode: 404, error });
    });

    test('sends a plain-text 500 when errors.html returns a body that is not a string', async () => {
      const brokenRouter = new HTTPRouter({
        adapter: mockAdapter,
        responseType: 'html',
        errors: { html: () => ({ error: 'Not found' }) as unknown as Html },
      });

      const result = await brokenRouter.handleEvent(createMockEvent({ path: '/missing' }), createMockContext());

      expect(result).toEqual(expect.objectContaining({ statusCode: 500, body: 'Internal Server Error' }));
      expect(errorSpy).toHaveBeenCalledWith('Response body is not a string', {
        responseType: 'html',
        bodyType: 'object',
      });
    });

    test("answers 500 with the route's errors for a thrown ApiResponse whose body cannot be sent", async () => {
      htmlRouter.get({ filters: { path: '/' }, handler: vi.fn().mockRejectedValue(Ok({ orderId: 'ord-1' })) });

      const result = await htmlRouter.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: '<h1>500 Internal Server Error</h1><p>Internal Server Error</p>',
        }),
      );
      expect(errorSpy).toHaveBeenCalledWith('Response body is not a string', {
        responseType: 'html',
        bodyType: 'object',
      });
    });

    test('adds CORS headers to an error page', async () => {
      const corsRouter = new HTTPRouter({
        adapter: mockAdapter,
        responseType: 'html',
        errors: { html: errorPage },
        cors: { origin: 'https://shop.example.com' },
      });

      const result = await corsRouter.handleEvent(createMockEvent({ path: '/missing' }), createMockContext());

      expect(result.headers).toEqual({
        'content-type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': 'https://shop.example.com',
        Vary: 'Origin',
      });
    });

    test('strips the body of an error page for HEAD', async () => {
      const result = await htmlRouter.handleEvent(
        createMockEvent({ method: 'HEAD', path: '/missing' }),
        createMockContext(),
      );

      expect(result).toEqual({
        statusCode: 404,
        body: '',
        headers: { 'content-type': 'text/html; charset=utf-8' },
        isBase64Encoded: false,
      });
    });
  });

  suite('handleEvent - HTTPException', () => {
    const issues = [{ message: 'Expected a SKU' }];

    test('sends the message as an error object on a JSON route', async () => {
      router.get({
        filters: { path: '/' },
        handler: vi.fn().mockRejectedValue(NotFound('Order ord-1 does not exist')),
      });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual({
        statusCode: 404,
        body: JSON.stringify({ error: 'Order ord-1 does not exist' }),
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('sends the message and the context on a JSON route', async () => {
      router.get({
        filters: { path: '/' },
        handler: vi.fn().mockRejectedValue(Conflict('Order is locked', { orderId: 'ord-1' })),
      });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 409,
          body: JSON.stringify({ error: 'Order is locked', context: { orderId: 'ord-1' } }),
        }),
      );
    });

    test.each([
      {
        name: 'a 400 for the query',
        schemas: { querySchema: createMockSchema({ issues }) },
        statusCode: 400,
        error: 'Bad Request',
      },
      {
        name: 'a 422 for the body',
        schemas: { bodySchema: createMockSchema({ issues }) },
        statusCode: 422,
        error: 'Unprocessable Content',
      },
    ])('passes the schema issues as the context for $name', async ({ schemas, statusCode, error }) => {
      router.post({ filters: { path: '/' }, handler: vi.fn(), ...schemas });

      const result = await router.handleEvent(
        createMockEvent({ method: 'POST', body: JSON.stringify({ sku: 7 }) }),
        createMockContext(),
      );

      expect(result).toEqual(expect.objectContaining({ statusCode, body: JSON.stringify({ error, context: issues }) }));
    });

    test('sends the default error body on a JSON route when there is no message', async () => {
      router.get({ filters: { path: '/' }, handler: vi.fn().mockRejectedValue(Forbidden()) });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({ statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }),
      );
    });

    test('sends the status name for a status no helper covers', async () => {
      router.get({ filters: { path: '/' }, handler: vi.fn().mockRejectedValue(new HTTPException(429)) });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({ statusCode: 429, body: JSON.stringify({ error: 'Too Many Requests' }) }),
      );
    });

    test('adds the headers of an HTTPException to the error response', async () => {
      const exception = new HTTPException(429, undefined, undefined, { 'retry-after': '30' });
      router.get({ filters: { path: '/' }, handler: vi.fn().mockRejectedValue(exception) });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result.headers).toEqual({ 'content-type': 'application/json', 'retry-after': '30' });
    });

    test.each([
      { name: 'thrown', handler: vi.fn().mockRejectedValue(NotFound('No such order')) },
      { name: 'returned', handler: vi.fn().mockResolvedValue(NotFound('No such order')) },
    ])('works the same when $name', async ({ handler }) => {
      router.get({ filters: { path: '/' }, handler });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual({
        statusCode: 404,
        body: JSON.stringify({ error: 'No such order' }),
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('sends a helper returned from middleware', async () => {
      const handler = vi.fn();
      const closed: HTTPMiddleware = async () => Conflict('The desk is closed');
      router.get({ filters: { path: '/' }, handler, middleware: [closed] });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({ statusCode: 409, body: JSON.stringify({ error: 'The desk is closed' }) }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('skips responseSchema for a returned HTTPException', async () => {
      const responseSchema = createMockSchema<{ orderId: string }>({ issues: [{ message: 'missing orderId' }] });
      router.get({ filters: { path: '/' }, handler: vi.fn().mockResolvedValue(NotFound()), responseSchema });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(responseSchema['~standard'].validate).not.toHaveBeenCalled();
      expect(result.statusCode).toBe(404);
    });

    test('sends a thrown ApiResponse as it is', async () => {
      router.get({ filters: { path: '/' }, handler: vi.fn().mockRejectedValue(TemporaryRedirect('/orders/ord-2')) });

      const result = await router.handleEvent(createMockEvent(), createMockContext());

      expect(result).toEqual({
        statusCode: 307,
        body: '',
        headers: { Location: '/orders/ord-2' },
        isBase64Encoded: false,
      });
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

  suite('handleEvent - body parsing', () => {
    const jsonBody = JSON.stringify({ name: 'test-item' });

    beforeEach(() => {
      safeJsonParseSpy.mockClear();
    });

    test.each([
      'GET',
      'HEAD',
      'DELETE',
      'OPTIONS',
    ] as const)('a %s route without a bodySchema hands the handler no body and does not parse it', async (method) => {
      const handler = vi.fn().mockResolvedValue(NoContent());
      router.route({ filters: { method, path: '/items' }, handler });

      await router.handleEvent(createMockEvent({ method, path: '/items', body: jsonBody }), createMockContext());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: undefined, rawBody: jsonBody }));
      expect(safeJsonParseSpy).not.toHaveBeenCalled();
    });

    test('a GET route with a bodySchema parses and validates the body', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({}));
      const bodySchema = createMockSchema();
      router.get({ filters: { path: '/items' }, handler, bodySchema });

      await router.handleEvent(createMockEvent({ path: '/items', body: jsonBody }), createMockContext());

      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ name: 'test-item' }, bodySchema);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { name: 'test-item' } }));
    });

    test('a GET route with a bodySchema returns 422 for an invalid body', async () => {
      const handler = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });
      router.get({ filters: { path: '/items' }, handler, bodySchema });

      const result = await router.handleEvent(createMockEvent({ path: '/items', body: jsonBody }), createMockContext());

      expect(result.statusCode).toBe(422);
      expect(handler).not.toHaveBeenCalled();
    });

    test('a POST route without a bodySchema does not parse a body the handler never reads', async () => {
      router.post({ filters: { path: '/items' }, handler: async () => NoContent() });

      await router.handleEvent(
        createMockEvent({ method: 'POST', path: '/items', body: jsonBody }),
        createMockContext(),
      );

      expect(safeJsonParseSpy).not.toHaveBeenCalled();
    });

    test('a POST route without a bodySchema parses the body when the handler reads it', async () => {
      let receivedBody: unknown;
      router.post({
        filters: { path: '/items' },
        handler: async (request: ApiRequest): Promise<HandlerResponse> => {
          receivedBody = request.body;
          return NoContent();
        },
      });

      await router.handleEvent(
        createMockEvent({ method: 'POST', path: '/items', body: jsonBody }),
        createMockContext(),
      );

      expect(receivedBody).toEqual({ name: 'test-item' });
    });

    test('a POST body read twice is parsed once', async () => {
      router.post({
        filters: { path: '/items' },
        handler: async (request: ApiRequest): Promise<HandlerResponse> =>
          Ok({ first: request.body, second: request.body }),
      });

      await router.handleEvent(
        createMockEvent({ method: 'POST', path: '/items', body: jsonBody }),
        createMockContext(),
      );

      expect(safeJsonParseSpy).toHaveBeenCalledOnce();
    });

    test('a body assigned by middleware reaches the handler', async () => {
      let receivedBody: unknown;
      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const replaceBody: HTTPMiddleware = async (request, next) => {
        request.body = { replaced: true };
        return next(request);
      };
      router.post({
        filters: { path: '/items' },
        middleware: [replaceBody],
        handler: async (request: ApiRequest): Promise<HandlerResponse> => {
          receivedBody = request.body;
          return NoContent();
        },
      });

      await router.handleEvent(
        createMockEvent({ method: 'POST', path: '/items', body: jsonBody }),
        createMockContext(),
      );

      expect(receivedBody).toEqual({ replaced: true });
    });

    test('a request spread by middleware carries the parsed body', async () => {
      let receivedBody: unknown;
      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const spreadRequest: HTTPMiddleware = async (request, next) =>
        next({ ...request, headers: { ...request.headers, 'x-added': 'yes' } });
      router.post({
        filters: { path: '/items' },
        middleware: [spreadRequest],
        handler: async (request: ApiRequest): Promise<HandlerResponse> => {
          receivedBody = request.body;
          return NoContent();
        },
      });

      await router.handleEvent(
        createMockEvent({ method: 'POST', path: '/items', body: jsonBody }),
        createMockContext(),
      );

      expect(receivedBody).toEqual({ name: 'test-item' });
    });
  });

  suite('handleEvent - responseSchema validation', () => {
    let errorSpy: MockInstance;

    beforeEach(() => {
      errorSpy = vi.spyOn(base.getLogger(), 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    test('answers 500 when a bare returned value fails the responseSchema', async () => {
      const handler = vi.fn().mockResolvedValue({ nothingLikeTheSchema: true });
      const responseSchema = createMockSchema<{ orderId: string }>({ issues: [{ message: 'missing orderId' }] });
      router.get({ filters: { path: '/orders' }, handler, responseSchema });

      const event = createMockEvent({ path: '/orders' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
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

    test.each([
      { name: 'Ok', response: Ok({ orderId: 1 }), statusCode: 200 },
      { name: 'Created', response: Created({ orderId: 1 }), statusCode: 201 },
    ])('runs responseSchema on $name', async ({ response, statusCode }) => {
      const responseSchema = createMockSchema({ value: { orderId: '1' } });
      router.post({ filters: { path: '/orders' }, handler: vi.fn().mockResolvedValue(response), responseSchema });

      const result = await router.handleEvent(
        createMockEvent({ method: 'POST', path: '/orders' }),
        createMockContext(),
      );

      expect(responseSchema['~standard'].validate).toHaveBeenCalledWith({ orderId: 1 });
      expect(result).toEqual(expect.objectContaining({ statusCode, body: JSON.stringify({ orderId: '1' }) }));
    });

    test('strips fields not in the responseSchema from Ok', async () => {
      const responseSchema = createMockSchema({ value: { orderId: 'ord-1' } });
      const handler = vi.fn().mockResolvedValue(Ok({ orderId: 'ord-1', internalNote: 'call the depot first' }));
      router.get({ filters: { path: '/orders' }, handler, responseSchema });

      const result = await router.handleEvent(createMockEvent({ path: '/orders' }), createMockContext());

      expect(result.body).toBe(JSON.stringify({ orderId: 'ord-1' }));
    });

    test('answers 500 when an Ok body fails its responseSchema', async () => {
      const responseSchema = createMockSchema<{ orderId: string }>({ issues: [{ message: 'missing orderId' }] });
      router.get({
        filters: { path: '/orders' },
        handler: vi.fn().mockResolvedValue(Ok({ sku: 'brk-9' })),
        responseSchema,
      });

      const result = await router.handleEvent(createMockEvent({ path: '/orders' }), createMockContext());

      expect(result).toEqual(
        expect.objectContaining({ statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) }),
      );
      expect(errorSpy).toHaveBeenCalledWith('Handler response failed its responseSchema', {
        issues: [{ message: 'missing orderId' }],
      });
    });

    test('runs responseSchema on a full 2xx ApiResponse', async () => {
      const responseSchema = createMockSchema<{ orderId: string }>({ issues: [{ message: 'missing orderId' }] });
      const handler = vi.fn().mockResolvedValue({ statusCode: 202, body: { sku: 'brk-9' } });
      router.get({ filters: { path: '/orders' }, handler, responseSchema });

      const result = await router.handleEvent(createMockEvent({ path: '/orders' }), createMockContext());

      expect(result.statusCode).toBe(500);
    });

    test('keeps the status and headers of a response it checks', async () => {
      const responseSchema = createMockSchema({ value: { orderId: 'ord-1' } });
      const handler = vi.fn().mockResolvedValue(Created({ orderId: 'ord-1' }, { location: '/orders/ord-1' }));
      router.post({ filters: { path: '/orders' }, handler, responseSchema });

      const result = await router.handleEvent(
        createMockEvent({ method: 'POST', path: '/orders' }),
        createMockContext(),
      );

      expect(result).toEqual({
        statusCode: 201,
        body: JSON.stringify({ orderId: 'ord-1' }),
        headers: { 'content-type': 'application/json', location: '/orders/ord-1' },
        isBase64Encoded: false,
      });
    });

    test.each([
      { name: 'a 409', response: Conflict('Order is locked'), statusCode: 409 },
      { name: 'a 307', response: TemporaryRedirect('/orders/ord-2'), statusCode: 307 },
    ])('skips responseSchema for a non-2xx response: $name', async ({ response, statusCode }) => {
      const responseSchema = createMockSchema<{ orderId: string }>({ issues: [{ message: 'missing orderId' }] });
      router.get({ filters: { path: '/orders' }, handler: vi.fn().mockResolvedValue(response), responseSchema });

      const result = await router.handleEvent(createMockEvent({ path: '/orders' }), createMockContext());

      expect(responseSchema['~standard'].validate).not.toHaveBeenCalled();
      expect(result.statusCode).toBe(statusCode);
    });

    test('answers 500 for NoContent when the responseSchema needs a body', async () => {
      const responseSchema = createMockSchema<{ orderId: string }>({ issues: [{ message: 'expected an object' }] });
      router.delete({ filters: { path: '/orders' }, handler: vi.fn().mockResolvedValue(NoContent()), responseSchema });

      const result = await router.handleEvent(
        createMockEvent({ method: 'DELETE', path: '/orders' }),
        createMockContext(),
      );

      expect(responseSchema['~standard'].validate).toHaveBeenCalledWith(undefined);
      expect(result.statusCode).toBe(500);
      expect(errorSpy).toHaveBeenCalledWith('Handler response failed its responseSchema', {
        issues: [{ message: 'expected an object' }],
      });
    });

    test('answers 500 for a bare undefined when the responseSchema needs a body', async () => {
      const responseSchema = createMockSchema<{ orderId: string }>({ issues: [{ message: 'expected an object' }] });
      router.delete({ filters: { path: '/orders' }, handler: vi.fn().mockResolvedValue(undefined), responseSchema });

      const result = await router.handleEvent(
        createMockEvent({ method: 'DELETE', path: '/orders' }),
        createMockContext(),
      );

      expect(responseSchema['~standard'].validate).toHaveBeenCalledWith(undefined);
      expect(result.statusCode).toBe(500);
      expect(errorSpy).toHaveBeenCalledWith('Handler response failed its responseSchema', {
        issues: [{ message: 'expected an object' }],
      });
    });
  });

  suite('handleEvent - custom', () => {
    test('matches route when custom returns true', async () => {
      const handler = vi.fn(async () => Ok({ message: 'hello' }));
      router.get({
        filters: { path: '/items', custom: () => true },
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

    test('returns 404 when custom returns false', async () => {
      const handler = vi.fn(async () => Ok({}));
      router.get({
        filters: { path: '/items', custom: () => false },
        handler,
      });

      const event = createMockEvent({ path: '/items' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not Found' }),
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('passes HTTPFilterInput populated from the normalized event', async () => {
      const custom = vi.fn().mockReturnValue(true);
      router.post({
        filters: { path: '/items', custom },
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

      expect(custom).toHaveBeenCalledOnce();
      expect(custom).toHaveBeenCalledWith({
        method: 'POST',
        path: '/items',
        headers: { 'x-trace-id': 'abc' },
        multiValueHeaders: {},
        query: { page: '1' },
        multiValueQuery: {},
        body: '{"name":"thing"}',
        auth: undefined,
        event,
      });
    });

    test('matches route when custom is async and resolves true', async () => {
      router.get({
        filters: {
          path: '/items',
          custom: async () => {
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

    test('returns 404 when async custom resolves false', async () => {
      router.get({
        filters: {
          path: '/items',
          custom: async () => {
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

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const middleware: HTTPMiddleware = async (request, next) => {
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

      const authMiddleware: HTTPMiddleware = async () => {
        return Unauthorized();
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

      const blockingRouteMiddleware: HTTPMiddleware = async () => {
        return Forbidden();
      };

      const route = defineRoute({
        filters: { method: 'GET', path: '/' },
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

      const route = defineRoute({
        filters: { method: 'GET', path: '/' },
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

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const routerMiddleware: HTTPMiddleware = async (request, next) => {
        callOrder.push('router-mw');
        return next(request);
      };

      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const routeMiddleware: HTTPMiddleware = async (request, next) => {
        callOrder.push('route-mw');
        return next(request);
      };

      const router = new HTTPRouter({ adapter: mockAdapter, middleware: [routerMiddleware] });
      const route = defineRoute({
        filters: { method: 'GET', path: '/' },
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

      const blockingMiddleware: HTTPMiddleware = async () => {
        return Forbidden();
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
        filters: { method: 'OPTIONS', path: '/items', custom: () => false },
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
      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const middleware: HTTPMiddleware = async (request, next) => {
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
