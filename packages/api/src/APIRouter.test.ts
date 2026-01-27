import { createApiEvent, test } from '@lambda-event-router/testing';
import { APIRouter, createApiRouter, defineRoute } from './APIRouter.js';
import { NoContent, Ok } from './Response.js';

describe('APIRouter', () => {
  describe('createApiRouter', () => {
    it('creates an APIRouter instance', () => {
      const router = createApiRouter();
      expect(router).toBeInstanceOf(APIRouter);
    });
  });

  describe('canHandleEvent', () => {
    it('returns true for a valid API Gateway V2 event', () => {
      const router = new APIRouter();
      const event = createApiEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    it('returns false for a non-API event', () => {
      const router = new APIRouter();
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });
  });

  describe('route', () => {
    it('returns the router instance for chaining', () => {
      const router = new APIRouter();
      const definition = defineRoute({
        method: 'GET',
        path: '/items',
      }).handle(async () => NoContent());

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  describe('get', () => {
    it('returns the router instance for chaining', () => {
      const router = new APIRouter();

      const result = router.get({
        path: '/items',
        handler: async () => Ok({ items: [] }),
      });

      expect(result).toBe(router);
    });
  });

  describe('post', () => {
    it('returns the router instance for chaining', () => {
      const router = new APIRouter();

      const result = router.post({
        path: '/items',
        handler: async () => Ok({ id: '1' }),
      });

      expect(result).toBe(router);
    });
  });

  describe('handleEvent', () => {
    test('calls the matched handler and returns a response with statusCode and body', async ({ apiHandlerEvent }) => {
      const router = new APIRouter();
      router.get({
        path: '/',
        handler: async () => Ok({ message: 'hello' }),
      });

      const { event, context } = apiHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
    });
  });

  describe('defineRoute', () => {
    it('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        method: 'GET',
        path: '/items',
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });
  });

  describe('full event processing', () => {
    test('routes GET and POST requests to different handlers', async ({ apiEvent, context }) => {
      const router = createApiRouter();
      router.get({
        path: '/items',
        handler: async () => Ok({ items: ['a', 'b'] }),
      });
      router.post({
        path: '/items',
        handler: async () => Ok({ id: 'new-item' }),
      });

      const getEvent = apiEvent({
        rawPath: '/items',
        requestContext: { http: { method: 'GET', path: '/items' } },
      });
      const mockContext = context();
      const getResult = await router.handleEvent(getEvent, mockContext);

      expect(getResult).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ items: ['a', 'b'] }),
        }),
      );

      const unknownEvent = apiEvent({
        rawPath: '/unknown',
        requestContext: { http: { method: 'GET', path: '/unknown' } },
      });
      const notFoundResult = await router.handleEvent(unknownEvent, mockContext);

      expect(notFoundResult).toEqual(
        expect.objectContaining({
          statusCode: 404,
        }),
      );
    });
  });
});
