import { defineRoute, NoContent, Ok } from '@lambda-event-router/http';
import { createALBEvent, createMockSchema, test } from '@lambda-event-router/testing';

import { ALBRouter, createALBRouter } from './ALBRouter.js';

suite('ALBRouter', () => {
  let router: ALBRouter;

  beforeEach(() => {
    router = new ALBRouter();
  });

  suite('createALBRouter', () => {
    test('creates an ALBRouter instance', () => {
      const router = createALBRouter();
      expect(router).toBeInstanceOf(ALBRouter);
    });
  });

  suite('cors', () => {
    test('answers an OPTIONS preflight when cors is configured', async ({ albHandlerEvent }) => {
      const corsRouter = createALBRouter({ cors: { origin: 'https://app.example.com' } });
      corsRouter.get({ filters: { path: '/items' }, handler: async () => Ok({}) });
      corsRouter.post({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = albHandlerEvent({
        event: { path: '/items', httpMethod: 'OPTIONS', headers: { origin: 'https://app.example.com' } },
      });
      const result = await corsRouter.handleEvent(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.headers).toEqual(
        expect.objectContaining({
          'Access-Control-Allow-Origin': 'https://app.example.com',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        }),
      );
    });

    test('adds cors headers to a handler response', async ({ albHandlerEvent }) => {
      const corsRouter = createALBRouter({ cors: { origin: '*' } });
      corsRouter.get({ filters: { path: '/items' }, handler: async () => Ok({ data: 'test' }) });

      const { event, context } = albHandlerEvent({ event: { path: '/items' } });
      const result = await corsRouter.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('adds no cors headers when cors is left off', async ({ albHandlerEvent }) => {
      const plainRouter = createALBRouter();
      plainRouter.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = albHandlerEvent({ event: { path: '/items' } });
      const result = await plainRouter.handleEvent(event, context);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid ALB event', () => {
      const event = createALBEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: {
          method: 'GET',
          path: '/items',
        },
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
      const result = router[method]({ filters: { path }, handler });

      expect(result).toBe(router);
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler and returns a response with statusCode and body', async ({ albHandlerEvent }) => {
      router.get({
        filters: {
          path: '/',
        },
        handler: async () => Ok({ message: 'hello' }),
      });

      const { event, context } = albHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
    });

    test('returns 404 when no route matches', async ({ albHandlerEvent }) => {
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = albHandlerEvent({ event: { path: '/unknown' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not found' }),
        }),
      );
    });

    test('catches a generic Error and returns 500 with the error message', async ({ albHandlerEvent }) => {
      router.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          throw new Error('something broke');
        },
      });

      const { event, context } = albHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'something broke' }),
        }),
      );
    });

    test('catches a non-Error throw and returns 500 with default message', async ({ albHandlerEvent }) => {
      router.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          throw 'string error';
        },
      });

      const { event, context } = albHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        }),
      );
    });

    test('validates the request before calling handler and returns 422 for body schema failure', async ({
      albHandlerEvent,
    }) => {
      const handler = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });
      router.post({ filters: { path: '/' }, handler, bodySchema });

      const { event, context } = albHandlerEvent({ event: { httpMethod: 'POST', body: { bad: 'data' } } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 422,
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('passes extracted path params to the handler', async ({ albHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ found: true }));
      router.get({ filters: { path: '/items/:id' }, handler });

      const { event, context } = albHandlerEvent({ event: { path: '/items/42' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: { id: '42' } }));
    });

    test('passes query params to the handler', async ({ albHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ items: [] }));
      router.get({ filters: { path: '/items' }, handler });

      const { event, context } = albHandlerEvent({
        event: { path: '/items', queryStringParameters: { page: '2', limit: '10' } },
      });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ query: { page: '2', limit: '10' } }));
    });

    test('passes parsed body to the handler', async ({ albHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ id: 'new-1' }));
      router.post({ filters: { path: '/items' }, handler });

      const { event, context } = albHandlerEvent({
        event: {
          path: '/items',
          httpMethod: 'POST',
          body: { name: 'test-item' },
        },
      });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { name: 'test-item' } }));
    });
  });

  suite('handleEvent - customFilter', () => {
    test('matches route when customFilter returns true', async ({ albHandlerEvent }) => {
      const handler = vi.fn(async () => Ok({ message: 'hello' }));
      router.get({
        filters: { path: '/items', customFilter: () => true },
        handler,
      });

      const { event, context } = albHandlerEvent({ event: { path: '/items' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
      expect(handler).toHaveBeenCalledOnce();
    });

    test('returns 404 when customFilter returns false', async ({ albHandlerEvent }) => {
      const handler = vi.fn(async () => Ok({}));
      router.get({
        filters: { path: '/items', customFilter: () => false },
        handler,
      });

      const { event, context } = albHandlerEvent({ event: { path: '/items' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not found' }),
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('matches route when customFilter is async and resolves true', async ({ albHandlerEvent }) => {
      router.get({
        filters: {
          path: '/items',
          customFilter: async () => {
            await new Promise((r) => setTimeout(r, 1));
            return true;
          },
        },
        handler: async () => Ok({ message: 'hello' }),
      });

      const { event, context } = albHandlerEvent({ event: { path: '/items' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
    });
  });
});
