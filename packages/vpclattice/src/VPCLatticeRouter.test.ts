import { defineRoute, NoContent, Ok } from '@lambda-event-router/http';
import { createMockSchema, createVPCLatticeV2Event, test } from '@lambda-event-router/testing';
import { createVPCLatticeRouter, VPCLatticeRouter } from './VPCLatticeRouter.js';

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
          body: JSON.stringify({ error: 'Not found' }),
        }),
      );
    });

    test('catches a generic Error and returns 500 with the error message', async ({ vpcLatticeV2HandlerEvent }) => {
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
          body: JSON.stringify({ error: 'something broke' }),
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
          body: JSON.stringify({ error: 'Internal server error' }),
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
});
