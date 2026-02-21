import { createWebSocketEvent, test } from '@lambda-event-router/testing';
import { createWebSocketRouter, defineWebSocketRoute, WebSocketRouter } from './WebSocketRouter.js';

suite('WebSocketRouter', () => {
  suite('createWebSocketRouter', () => {
    test('creates a WebSocketRouter instance', () => {
      const router = createWebSocketRouter();
      expect(router).toBeInstanceOf(WebSocketRouter);
    });
  });

  suite('canHandleEvent', () => {
    let router: WebSocketRouter;

    beforeEach(() => {
      router = new WebSocketRouter();
    });

    test('returns true for a valid WebSocket event', () => {
      const event = createWebSocketEvent();
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

    test('returns false when event has rawPath (HTTP event, not WebSocket)', () => {
      const event = {
        rawPath: '/items',
        requestContext: { connectionId: 'abc', eventType: 'MESSAGE', routeKey: '$default' },
      };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext is missing', () => {
      const event = { body: 'hello' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext is not an object', () => {
      const event = { requestContext: 'bad' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when connectionId is missing', () => {
      const event = { requestContext: { eventType: 'MESSAGE', routeKey: '$default' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when connectionId is not a string', () => {
      const event = { requestContext: { connectionId: 123, eventType: 'MESSAGE', routeKey: '$default' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when eventType is missing', () => {
      const event = { requestContext: { connectionId: 'abc', routeKey: '$default' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when eventType is not a string', () => {
      const event = { requestContext: { connectionId: 'abc', eventType: 42, routeKey: '$default' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when routeKey is missing', () => {
      const event = { requestContext: { connectionId: 'abc', eventType: 'MESSAGE' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when routeKey is not a string', () => {
      const event = { requestContext: { connectionId: 'abc', eventType: 'MESSAGE', routeKey: 99 } };
      expect(router.canHandleEvent(event)).toBe(false);
    });
  });

  suite('route (chaining)', () => {
    test('returns the router instance for chaining', () => {
      const router = new WebSocketRouter();
      const definition = defineWebSocketRoute({
        filters: { eventType: 'MESSAGE' },
      }).handle(async () => undefined);

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('connect / disconnect / message (chaining)', () => {
    test('connect returns the router instance for chaining', () => {
      const router = new WebSocketRouter();
      const result = router.connect({ handler: async () => ({ statusCode: 200 }) });
      expect(result).toBe(router);
    });

    test('disconnect returns the router instance for chaining', () => {
      const router = new WebSocketRouter();
      const result = router.disconnect({ handler: async () => {} });
      expect(result).toBe(router);
    });

    test('message returns the router instance for chaining', () => {
      const router = new WebSocketRouter();
      const result = router.message({ handler: async () => {} });
      expect(result).toBe(router);
    });
  });

  suite('defineWebSocketRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineWebSocketRoute({
        filters: { eventType: 'MESSAGE' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, bodySchema, and handler in the definition', () => {
      const bodySchema = { safeParse: vi.fn() };
      const handler = vi.fn();

      const definition = defineWebSocketRoute({
        filters: { eventType: 'MESSAGE', routeKey: 'sendMessage' },
        bodySchema,
      }).handle(handler);

      expect(definition.filters).toEqual({ eventType: 'MESSAGE', routeKey: 'sendMessage' });
      expect(definition.bodySchema).toBe(bodySchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('handleEvent', () => {
    test('calls matched CONNECT handler and returns { statusCode: 200 }', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue({ statusCode: 200 });
      const router = new WebSocketRouter();
      router.connect({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { requestContext: { eventType: 'CONNECT', routeKey: '$connect' } },
      });
      const result = await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ statusCode: 200 });
    });

    test('calls matched DISCONNECT handler and returns { statusCode: 200 }', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const router = new WebSocketRouter();
      router.disconnect({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { requestContext: { eventType: 'DISCONNECT', routeKey: '$disconnect' } },
      });
      const result = await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ statusCode: 200 });
    });

    test('calls matched MESSAGE handler and returns { statusCode: 200 }', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const router = new WebSocketRouter();
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ statusCode: 200 });
    });

    test('throws when no route matches', async ({ webSocketHandlerEvent }) => {
      const router = new WebSocketRouter();

      const { event, context } = webSocketHandlerEvent({
        event: { requestContext: { eventType: 'MESSAGE', routeKey: 'unknown' } },
      });

      await expect(router.handleEvent(event, context)).rejects.toThrow(
        'No route matched for WebSocket event (eventType: MESSAGE, routeKey: unknown)',
      );
    });

    test('passes connectionId, domainName, stage, eventType, routeKey to handler', async ({
      webSocketHandlerEvent,
    }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const router = new WebSocketRouter();
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: {
          requestContext: {
            connectionId: 'conn-123',
            domainName: 'test.example.com',
            stage: 'prod',
            eventType: 'MESSAGE',
            routeKey: '$default',
          },
        },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: 'conn-123',
          domainName: 'test.example.com',
          stage: 'prod',
          eventType: 'MESSAGE',
          routeKey: '$default',
        }),
      );
    });

    test('passes queryStringParameters from event to handler', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const router = new WebSocketRouter();
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { queryStringParameters: { token: 'abc123' } },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ queryStringParameters: { token: 'abc123' } }));
    });

    test('passes event and context on the request object', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const router = new WebSocketRouter();
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ event, context }));
    });

    test('passes parsed JSON body to MESSAGE handler', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const router = new WebSocketRouter();
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: '{"action":"test","data":42}' },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { action: 'test', data: 42 } }));
    });

    test('returns raw string body when JSON parsing fails', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const router = new WebSocketRouter();
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: 'not-json' },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: 'not-json' }));
    });

    test('returns undefined body when body is absent', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const router = new WebSocketRouter();
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent({ event: { body: '' } });
      // Empty string body is treated as falsy by parseBody
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: undefined }));
    });

    test('validates body against schema when provided', async ({ webSocketHandlerEvent }) => {
      const parsedData = { action: 'test' };
      const bodySchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: parsedData }) };
      const handler = vi.fn().mockResolvedValue(undefined);
      const router = new WebSocketRouter();
      router.message({ bodySchema, handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: JSON.stringify(parsedData) },
      });
      await router.handleEvent(event, context);

      expect(bodySchema.safeParse).toHaveBeenCalledExactlyOnceWith(parsedData);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: parsedData }));
    });

    test('throws "Body validation failed" and does not call handler when schema validation fails', async ({
      webSocketHandlerEvent,
    }) => {
      const bodySchema = { safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid' }) };
      const handler = vi.fn();
      const router = new WebSocketRouter();
      router.message({ bodySchema, handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: '{"bad":"data"}' },
      });

      await expect(router.handleEvent(event, context)).rejects.toThrow('Body validation failed');
      expect(handler).not.toHaveBeenCalled();
    });

    test('catches error with statusCode property and returns it', async ({ webSocketHandlerEvent }) => {
      const router = new WebSocketRouter();
      router.message({
        handler: async () => {
          throw { statusCode: 403 };
        },
      });

      const { event, context } = webSocketHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 403 });
    });

    test('re-throws errors without statusCode', async ({ webSocketHandlerEvent }) => {
      const router = new WebSocketRouter();
      router.message({
        handler: async () => {
          throw new Error('unexpected error');
        },
      });

      const { event, context } = webSocketHandlerEvent();

      await expect(router.handleEvent(event, context)).rejects.toThrow('unexpected error');
    });

    test('handler returning undefined normalizes to { statusCode: 200 }', async ({ webSocketHandlerEvent }) => {
      const router = new WebSocketRouter();
      router.message({ handler: async () => undefined });

      const { event, context } = webSocketHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 200 });
    });

    test('handler returning { statusCode: number } passes through', async ({ webSocketHandlerEvent }) => {
      const router = new WebSocketRouter();
      router.connect({ handler: async () => ({ statusCode: 403 }) });

      const { event, context } = webSocketHandlerEvent({
        event: { requestContext: { eventType: 'CONNECT', routeKey: '$connect' } },
      });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 403 });
    });
  });

  suite('matchRoute (private)', () => {
    test('matches route with matching eventType', () => {
      const router = new WebSocketRouter();
      router.connect({ handler: async () => ({ statusCode: 200 }) });

      // @ts-expect-error - testing private method
      const result = router.matchRoute({ eventType: 'CONNECT', routeKey: '$connect' });

      expect(result).toBeDefined();
    });

    test('does not match route with different eventType', () => {
      const router = new WebSocketRouter();
      router.connect({ handler: async () => ({ statusCode: 200 }) });

      // @ts-expect-error - testing private method
      const result = router.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result).toBeUndefined();
    });

    test('matches route with matching routeKey', () => {
      const router = new WebSocketRouter();
      router.message({ routeKey: 'sendMessage', handler: async () => {} });

      // @ts-expect-error - testing private method
      const result = router.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeDefined();
    });

    test('does not match route with different routeKey', () => {
      const router = new WebSocketRouter();
      router.message({ routeKey: 'sendMessage', handler: async () => {} });

      // @ts-expect-error - testing private method
      const result = router.matchRoute({ eventType: 'MESSAGE', routeKey: 'otherAction' });

      expect(result).toBeUndefined();
    });

    test('route without eventType filter matches any eventType', () => {
      const router = new WebSocketRouter();
      const definition = defineWebSocketRoute({ filters: {} }).handle(async () => undefined);
      router.route(definition);

      // @ts-expect-error - testing private method
      const result = router.matchRoute({ eventType: 'DISCONNECT', routeKey: '$disconnect' });

      expect(result).toBeDefined();
    });

    test('route without routeKey filter matches any routeKey', () => {
      const router = new WebSocketRouter();
      router.message({ handler: async () => {} });

      // @ts-expect-error - testing private method
      const result = router.matchRoute({ eventType: 'MESSAGE', routeKey: 'anyRoute' });

      expect(result).toBeDefined();
    });

    test('route without any filters matches everything', () => {
      const router = new WebSocketRouter();
      const definition = defineWebSocketRoute({ filters: {} }).handle(async () => undefined);
      router.route(definition);

      // @ts-expect-error - testing private method
      const result = router.matchRoute({ eventType: 'CONNECT', routeKey: '$connect' });

      expect(result).toBeDefined();
    });

    test('returns first matching route when multiple match', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      const router = new WebSocketRouter();
      router.message({ handler: firstHandler });
      router.message({ handler: secondHandler });

      // @ts-expect-error - testing private method
      const result = router.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result?.handler).toBe(firstHandler);
    });
  });

  suite('parseBody (private)', () => {
    test('returns undefined for undefined body', () => {
      const router = new WebSocketRouter();
      // @ts-expect-error - testing private method
      expect(router.parseBody(undefined)).toBeUndefined();
    });

    test('returns undefined for empty string body', () => {
      const router = new WebSocketRouter();
      // @ts-expect-error - testing private method
      expect(router.parseBody('')).toBeUndefined();
    });

    test('parses valid JSON string', () => {
      const router = new WebSocketRouter();
      // @ts-expect-error - testing private method
      expect(router.parseBody('{"key":"value"}')).toEqual({ key: 'value' });
    });

    test('returns raw string for invalid JSON', () => {
      const router = new WebSocketRouter();
      // @ts-expect-error - testing private method
      expect(router.parseBody('not-json')).toBe('not-json');
    });
  });

  suite('validateBody (private)', () => {
    test('returns body as-is when no schema', () => {
      const router = new WebSocketRouter();
      // @ts-expect-error - testing private method
      expect(router.validateBody({ key: 'value' }, undefined)).toEqual({ key: 'value' });
    });

    test('returns parsed data on successful validation', () => {
      const parsedData = { key: 'validated' };
      const schema = { safeParse: vi.fn().mockReturnValue({ success: true, data: parsedData }) };
      const router = new WebSocketRouter();

      // @ts-expect-error - testing private method
      const result = router.validateBody({ key: 'raw' }, schema);

      expect(result).toEqual(parsedData);
    });

    test('throws on failed validation', () => {
      const schema = { safeParse: vi.fn().mockReturnValue({ success: false, error: 'bad' }) };
      const router = new WebSocketRouter();

      // @ts-expect-error - testing private method
      expect(() => router.validateBody({ key: 'bad' }, schema)).toThrow('Body validation failed');
    });
  });

  suite('buildResult (private)', () => {
    test('returns { statusCode: 200 } for undefined response', () => {
      const router = new WebSocketRouter();
      // @ts-expect-error - testing private method
      expect(router.buildResult(undefined)).toEqual({ statusCode: 200 });
    });

    test('returns { statusCode: 200 } for null response', () => {
      const router = new WebSocketRouter();
      // @ts-expect-error - testing private method
      expect(router.buildResult(null)).toEqual({ statusCode: 200 });
    });

    test('returns response as-is when it has a numeric statusCode', () => {
      const router = new WebSocketRouter();
      // @ts-expect-error - testing private method
      expect(router.buildResult({ statusCode: 403 })).toEqual({ statusCode: 403 });
    });

    test('returns { statusCode: 200 } for unexpected response shape', () => {
      const router = new WebSocketRouter();
      // @ts-expect-error - testing private method
      expect(router.buildResult('unexpected')).toEqual({ statusCode: 200 });
    });
  });
});
