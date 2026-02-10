import { createApiGatewayV2Event, test } from '@lambda-event-router/testing';
import { HTTPRouter } from './HTTPRouter.js';
import { Ok, Response } from './Response.js';

class ApiRouter extends HTTPRouter {}

suite('ApiRouter', () => {
  suite('canHandleEvent', () => {
    let router: ApiRouter;

    beforeEach(() => {
      router = new ApiRouter();
    });

    test('returns true for a valid API Gateway V2 event', () => {
      const event = createApiGatewayV2Event();
      expect(router.canHandleEvent(event)).toBe(true);
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler and returns a response with statusCode and body', async ({
      apiGatewayV2HandlerEvent,
    }) => {
      const router = new ApiRouter();
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
      const router = new ApiRouter();
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

    test('catches a thrown HTTPResponse and returns it as the response', async ({ apiGatewayV2HandlerEvent }) => {
      const router = new ApiRouter();
      router.get({
        path: '/',
        handler: async () => {
          throw Response.Unauthorised();
        },
      });

      const { event, context } = apiGatewayV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 401,
          body: JSON.stringify({ error: 'Unauthorised' }),
        }),
      );
    });

    test('catches a generic Error and returns 500 with the error message', async ({ apiGatewayV2HandlerEvent }) => {
      const router = new ApiRouter();
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
      const router = new ApiRouter();
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
      const bodySchema = { safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid body' }) };
      const router = new ApiRouter();
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
      const router = new ApiRouter();
      router.get({ path: '/items/:id', handler });

      const { event, context } = apiGatewayV2HandlerEvent({ event: { rawPath: '/items/42' } });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: { id: '42' } }));
    });

    test('passes query params to the handler', async ({ apiGatewayV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ items: [] }));
      const router = new ApiRouter();
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
      const router = new ApiRouter();
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
});
