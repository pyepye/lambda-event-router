import type { Middleware } from '@lambda-event-router/base';
import * as base from '@lambda-event-router/base';
import { createMockContext, createMockSchema } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
import { defineRoute, HTTPRouter } from './HTTPRouter.js';
import { NoContent, Ok } from './Response.js';
import type { ApiRequest, ApiResponse, FinalizedHTTPResponse, HTTPAdapter, NormalizedHTTPEvent } from './types.js';

const validateSchemaResultSpy: MockInstance = vi.spyOn(base, 'validateSchemaResult');

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
});
