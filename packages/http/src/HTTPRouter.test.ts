import { defineRoute, HTTPRouter } from './HTTPRouter.js';
import { NoContent, Ok } from './Response.js';
import type { FinalizedHTTPResponse, HTTPAdapter, NormalizedHTTPEvent } from './types.js';

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
  suite('canHandleEvent', () => {
    let router: HTTPRouter<MockEvent, MockResult>;

    beforeEach(() => {
      router = new HTTPRouter(mockAdapter);
    });

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

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const router = new HTTPRouter(mockAdapter);
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
      const router = new HTTPRouter(mockAdapter);

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
      const pathSchema = { safeParse: vi.fn() };
      const querySchema = { safeParse: vi.fn() };
      const bodySchema = { safeParse: vi.fn() };
      const responseSchema = { safeParse: vi.fn() };
      const handler = vi.fn();

      const definition = defineRoute({
        method: 'POST',
        path: '/items/:id',
        pathSchema,
        querySchema,
        bodySchema,
        responseSchema,
      }).handle(handler);

      expect(definition.method).toBe('POST');
      expect(definition.path).toBe('/items/:id');
      expect(definition.pathSchema).toBe(pathSchema);
      expect(definition.querySchema).toBe(querySchema);
      expect(definition.bodySchema).toBe(bodySchema);
      expect(definition.responseSchema).toBe(responseSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler and returns a response', async () => {
      const router = new HTTPRouter(mockAdapter);
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
      const router = new HTTPRouter(mockAdapter);
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
      const router = new HTTPRouter(mockAdapter);
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
      const router = new HTTPRouter(mockAdapter);
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
      const router = new HTTPRouter(mockAdapter);
      router.get({ path: '/items/:id', handler });

      const event = createMockEvent({ path: '/items/42' });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: { id: '42' } }));
    });

    test('passes query params to the handler', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({ items: [] }));
      const router = new HTTPRouter(mockAdapter);
      router.get({ path: '/items', handler });

      const event = createMockEvent({ path: '/items', query: { page: '2', limit: '10' } });
      const context = { functionName: 'test' } as Parameters<typeof router.handleEvent>[1];
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ query: { page: '2', limit: '10' } }));
    });

    test('passes parsed body to the handler', async () => {
      const handler = vi.fn().mockResolvedValue(Ok({ id: 'new-1' }));
      const router = new HTTPRouter(mockAdapter);
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
      const bodySchema = { safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid body' }) };
      const router = new HTTPRouter(mockAdapter);
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
    });
  });
});
