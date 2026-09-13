import { type ErrorInput, Html, NoContent, Ok } from '@lambda-event-router/http';
import { allEventBuilders, createMockSchema, createVPCLatticeV2Event, test } from '@lambda-event-router/testing';

import type { HTTPMiddleware } from './types.js';
import { createVPCLatticeRouter, defineRoute, VPCLatticeRouter } from './VPCLatticeRouter.js';

suite('VPCLatticeRouter', () => {
  let router: VPCLatticeRouter;

  beforeEach(() => {
    router = new VPCLatticeRouter();
  });

  suite('createVPCLatticeRouter', () => {
    test('creates a VPCLatticeRouter instance', () => {
      const router = createVPCLatticeRouter();
      expect(router).toBeInstanceOf(VPCLatticeRouter);
    });
  });

  suite('cors', () => {
    test('answers an OPTIONS preflight when cors is configured', async ({ vpcLatticeV2HandlerEvent }) => {
      const corsRouter = createVPCLatticeRouter({ cors: { origin: 'https://app.example.com' } });
      corsRouter.get({ filters: { path: '/items' }, handler: async () => Ok({}) });
      corsRouter.post({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = vpcLatticeV2HandlerEvent({
        event: { path: '/items', method: 'OPTIONS', headers: { origin: ['https://app.example.com'] } },
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

    test('adds cors headers to a handler response', async ({ vpcLatticeV2HandlerEvent }) => {
      const corsRouter = createVPCLatticeRouter({ cors: { origin: '*' } });
      corsRouter.get({ filters: { path: '/items' }, handler: async () => Ok({ data: 'test' }) });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items' } });
      const result = await corsRouter.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('adds no cors headers when cors is left off', async ({ vpcLatticeV2HandlerEvent }) => {
      const plainRouter = createVPCLatticeRouter();
      plainRouter.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items' } });
      const result = await plainRouter.handleEvent(event, context);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid VPC Lattice V2 event', () => {
      const event = createVPCLatticeV2Event();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test.each([
      { label: 'null', value: null },
      { label: 'a string', value: 'not an event' },
      { label: 'a number', value: 42 },
      { label: 'an array', value: [1, 2, 3] },
    ])('returns false for $label', ({ value }) => {
      expect(router.canHandleEvent(value)).toBe(false);
    });

    test('returns false for events missing key fields', () => {
      expect(router.canHandleEvent({ Records: [] })).toBe(false);
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
    test('calls the matched handler and returns a response with statusCode and body', async ({
      vpcLatticeV2HandlerEvent,
    }) => {
      router.get({
        filters: {
          path: '/',
        },
        handler: async () => Ok({ message: 'hello' }),
      });

      const { event, context } = vpcLatticeV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
    });

    test('returns 404 when no route matches', async ({ vpcLatticeV2HandlerEvent }) => {
      router.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/unknown' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not Found' }),
        }),
      );
    });

    test('hides the message of an unhandled error', async ({ vpcLatticeV2HandlerEvent }) => {
      router.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          throw new Error('something broke');
        },
      });

      const { event, context } = vpcLatticeV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );
    });

    test('catches a non-Error throw and returns 500 with default message', async ({ vpcLatticeV2HandlerEvent }) => {
      router.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          throw 'string error';
        },
      });

      const { event, context } = vpcLatticeV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );
    });

    test('validates the request before calling handler and returns 422 for body schema failure', async ({
      vpcLatticeV2HandlerEvent,
    }) => {
      const handler = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });
      router.post({ filters: { path: '/' }, handler, bodySchema });

      const { event, context } = vpcLatticeV2HandlerEvent({
        event: { method: 'POST', body: { bad: 'data' } },
      });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 422,
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('passes extracted path params to the handler', async ({ vpcLatticeV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ found: true }));
      router.get({ filters: { path: '/items/:id' }, handler });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items/42' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: { id: '42' } }));
    });

    test('passes query params to the handler', async ({ vpcLatticeV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ items: [] }));
      router.get({ filters: { path: '/items' }, handler });

      const { event, context } = vpcLatticeV2HandlerEvent({
        event: { path: '/items', queryStringParameters: { page: ['2'], limit: ['10'] } },
      });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ query: { page: '2', limit: '10' } }));
    });

    test('gives a bare HTTPMiddleware the output of the querySchema', async ({ vpcLatticeV2HandlerEvent }) => {
      let receivedQuery: unknown;
      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const readsQuery: HTTPMiddleware = async (request, next) => {
        receivedQuery = request.query;
        return next(request);
      };
      router.get({
        filters: { path: '/items' },
        querySchema: createMockSchema({ value: { limit: 10 } }),
        middleware: [readsQuery],
        handler: async () => NoContent(),
      });

      const { event, context } = vpcLatticeV2HandlerEvent({
        event: { path: '/items', queryStringParameters: { limit: ['10'] } },
      });
      await router.handleEvent(event, context);

      expect(receivedQuery).toEqual({ limit: 10 });
    });

    test('passes parsed body to the handler', async ({ vpcLatticeV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ id: 'new-1' }));
      router.post({ filters: { path: '/items' }, handler });

      const { event, context } = vpcLatticeV2HandlerEvent({
        event: {
          path: '/items',
          method: 'POST',
          body: { name: 'test-item' },
        },
      });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { name: 'test-item' } }));
    });
  });

  suite('handleEvent - custom', () => {
    test('matches route when custom returns true', async ({ vpcLatticeV2HandlerEvent }) => {
      const handler = vi.fn(async () => Ok({ message: 'hello' }));
      router.get({
        filters: { path: '/items', custom: () => true },
        handler,
      });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
      expect(handler).toHaveBeenCalledOnce();
    });

    test('returns 404 when custom returns false', async ({ vpcLatticeV2HandlerEvent }) => {
      const handler = vi.fn(async () => Ok({}));
      router.get({
        filters: { path: '/items', custom: () => false },
        handler,
      });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not Found' }),
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('matches route when custom is async and resolves true', async ({ vpcLatticeV2HandlerEvent }) => {
      router.get({
        filters: {
          path: '/items',
          custom: async () => {
            await new Promise((r) => setTimeout(r, 1));
            return true;
          },
        },
        handler: async () => Ok({ message: 'hello' }),
      });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items' } });
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

suite('VPCLatticeRouter.canHandleEvent', () => {
  const ownEvents = ['createVPCLatticeV1Event', 'createVPCLatticeV2Event'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createVPCLatticeRouter().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
  suite('response types', () => {
    const errors = {
      html: ({ statusCode, statusText }: ErrorInput): Html => Html(`<h1>${statusCode} ${statusText}</h1>`),
    };

    test('sends Html and error pages from an HTML router', async ({ vpcLatticeV2HandlerEvent }) => {
      const htmlRouter = new VPCLatticeRouter({ responseType: 'html', errors });
      htmlRouter.get({ filters: { path: '/orders' }, handler: async () => Html('<p>Orders</p>') });

      const page = vpcLatticeV2HandlerEvent({ event: { path: '/orders' } });
      const missing = vpcLatticeV2HandlerEvent({ event: { path: '/missing' } });
      const pageResult = await htmlRouter.handleEvent(page.event, page.context);
      const missingResult = await htmlRouter.handleEvent(missing.event, missing.context);

      expect(pageResult).toEqual(expect.objectContaining({ statusCode: 200, body: '<p>Orders</p>' }));
      expect(pageResult.headers).toEqual({ 'content-type': 'text/html; charset=utf-8' });
      expect(missingResult).toEqual(expect.objectContaining({ statusCode: 404, body: '<h1>404 Not Found</h1>' }));
    });

    test('accepts an inline errors.html whose parameters are inferred', () => {
      expect(
        () =>
          new VPCLatticeRouter({
            responseType: 'html',
            // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
            errors: { html: ({ statusCode }) => Html(`<h1>${statusCode}</h1>`) },
          }),
      ).not.toThrow();
      expect(() =>
        createVPCLatticeRouter({
          responseType: 'html',
          // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
          errors: { html: ({ statusCode }) => Html(`<h1>${statusCode}</h1>`) },
        }),
      ).not.toThrow();
    });

    test('rejects an HTML router with no errors.html', () => {
      // @ts-expect-error - an HTML router needs errors.html
      expect(() => new VPCLatticeRouter({ responseType: 'html' })).toThrow(
        'Response type configuration error: an HTML router needs errors.html',
      );
    });
  });
});
