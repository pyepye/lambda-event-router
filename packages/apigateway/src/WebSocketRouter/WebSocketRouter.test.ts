import type { MockInstance } from 'vitest';

import * as base from '@lambda-event-router/base';
import { createMockSchema, createWebSocketEvent, test } from '@lambda-event-router/testing';

import type { WebSocketConnectResponse, WebSocketFilterInput, WebSocketRequest } from './types.js';
import { createWebSocketRouter, defineWebSocketRoute, WebSocketRouter } from './WebSocketRouter.js';

type WebSocketNext = (request: WebSocketRequest) => Promise<WebSocketConnectResponse>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');
const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');

suite('WebSocketRouter', () => {
  let router: WebSocketRouter;

  beforeEach(() => {
    router = new WebSocketRouter();
  });

  suite('createWebSocketRouter', () => {
    test('creates a WebSocketRouter instance', () => {
      const router = createWebSocketRouter();
      expect(router).toBeInstanceOf(WebSocketRouter);
    });
  });

  suite('canHandleEvent', () => {
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
      const definition = defineWebSocketRoute({
        filters: { eventType: 'MESSAGE' },
      }).handle(async () => undefined);

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('connect / disconnect / message (chaining)', () => {
    test('connect returns the router instance for chaining', () => {
      const result = router.connect({ handler: async () => ({ statusCode: 200 }) });
      expect(result).toBe(router);
    });

    test('disconnect returns the router instance for chaining', () => {
      const result = router.disconnect({ handler: async () => {} });
      expect(result).toBe(router);
    });

    test('message returns the router instance for chaining', () => {
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
      const bodySchema = createMockSchema();
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
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ statusCode: 200 });
    });

    test('throws when no route matches', async ({ webSocketHandlerEvent }) => {
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
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { queryStringParameters: { token: 'abc123' } },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ queryStringParameters: { token: 'abc123' } }));
    });

    test('passes event and context on the request object', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ event, context }));
    });

    test('passes parsed JSON body to MESSAGE handler', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: '{"action":"test","data":42}' },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { action: 'test', data: 42 } }));
    });

    test('returns raw string body when JSON parsing fails', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: 'not-json' },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: 'not-json' }));
    });

    test('returns undefined body when body is absent', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent({ event: { body: '' } });
      // Empty string body is treated as falsy by parseBody
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: undefined }));
    });

    test('validates body against schema when provided', async ({ webSocketHandlerEvent }) => {
      const bodySchema = createMockSchema();
      const handler = vi.fn().mockResolvedValue(undefined);
      router.message({ bodySchema, handler });

      const body = JSON.stringify({ action: 'test' });
      const { event, context } = webSocketHandlerEvent({
        event: { body },
      });
      await router.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith({ action: 'test' }, bodySchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { action: 'test' } }));
    });

    test('throws "Body validation failed" and does not call handler when schema validation fails', async ({
      webSocketHandlerEvent,
    }) => {
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      const handler = vi.fn();
      router.message({ bodySchema, handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: '{"bad":"data"}' },
      });

      await expect(router.handleEvent(event, context)).rejects.toThrow('Body validation failed');
      expect(handler).not.toHaveBeenCalled();
    });

    test('catches error with statusCode property and returns it', async ({ webSocketHandlerEvent }) => {
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
      router.message({
        handler: async () => {
          throw new Error('unexpected error');
        },
      });

      const { event, context } = webSocketHandlerEvent();

      await expect(router.handleEvent(event, context)).rejects.toThrow('unexpected error');
    });

    test('handler returning undefined normalizes to { statusCode: 200 }', async ({ webSocketHandlerEvent }) => {
      router.message({ handler: async () => undefined });

      const { event, context } = webSocketHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 200 });
    });

    test('handler returning { statusCode: number } passes through', async ({ webSocketHandlerEvent }) => {
      router.connect({ handler: async () => ({ statusCode: 403 }) });

      const { event, context } = webSocketHandlerEvent({
        event: { requestContext: { eventType: 'CONNECT', routeKey: '$connect' } },
      });
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 403 });
    });
  });

  suite('matchRoute (private)', () => {
    test('matches route with matching eventType', async () => {
      router.connect({ handler: async () => ({ statusCode: 200 }) });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'CONNECT', routeKey: '$connect' });

      expect(result).toBeDefined();
    });

    test('does not match route with different eventType', async () => {
      router.connect({ handler: async () => ({ statusCode: 200 }) });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result).toBeUndefined();
    });

    test('matches route with matching routeKey', async () => {
      router.message({ routeKey: 'sendMessage', handler: async () => {} });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeDefined();
    });

    test('does not match route with different routeKey', async () => {
      router.message({ routeKey: 'sendMessage', handler: async () => {} });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'MESSAGE', routeKey: 'otherAction' });

      expect(result).toBeUndefined();
    });

    test('route without eventType filter matches any eventType', async () => {
      const definition = defineWebSocketRoute({ filters: {} }).handle(async () => undefined);
      router.route(definition);

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'DISCONNECT', routeKey: '$disconnect' });

      expect(result).toBeDefined();
    });

    test('route without routeKey filter matches any routeKey', async () => {
      router.message({ handler: async () => {} });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'MESSAGE', routeKey: 'anyRoute' });

      expect(result).toBeDefined();
    });

    test('route without any filters matches everything', async () => {
      const definition = defineWebSocketRoute({ filters: {} }).handle(async () => undefined);
      router.route(definition);

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'CONNECT', routeKey: '$connect' });

      expect(result).toBeDefined();
    });

    test('returns first matching route when multiple match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.message({ handler: firstHandler });
      router.message({ handler: secondHandler });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result?.handler).toBe(firstHandler);
    });

    test('matches route by custom', async () => {
      router.route(
        defineWebSocketRoute({
          filters: {
            custom: ({ routeKey }: WebSocketFilterInput): boolean => routeKey === 'sendMessage',
          },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeDefined();
    });

    test('matches route by custom', async () => {
      router.route(
        defineWebSocketRoute({
          filters: {
            custom: async ({ routeKey }: WebSocketFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              return routeKey === 'sendMessage';
            },
          },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeDefined();
    });

    test('does not match route when custom returns false', async () => {
      router.route(
        defineWebSocketRoute({
          filters: {
            custom: (): boolean => false,
          },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result).toBeUndefined();
    });

    test('passes correct filterInput to custom', async () => {
      const custom = vi.fn().mockReturnValue(true);
      router.route(
        defineWebSocketRoute({
          filters: { custom },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      router.matchRoute({ eventType: 'CONNECT', routeKey: '$connect' });

      expect(custom).toHaveBeenCalledWith({
        eventType: 'CONNECT',
        routeKey: '$connect',
      });
    });

    test('matches when standard filters and custom both pass', async () => {
      router.route(
        defineWebSocketRoute({
          filters: {
            eventType: 'MESSAGE',
            custom: ({ routeKey }: WebSocketFilterInput): boolean => routeKey === 'sendMessage',
          },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeDefined();
    });

    test('does not match when standard filters pass but custom returns false', async () => {
      router.route(
        defineWebSocketRoute({
          filters: {
            eventType: 'MESSAGE',
            custom: (): boolean => false,
          },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result).toBeUndefined();
    });

    test('custom is not called when an earlier filter fails', async () => {
      const custom = vi.fn().mockReturnValue(true);
      router.route(
        defineWebSocketRoute({
          filters: {
            eventType: 'CONNECT',
            custom,
          },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      router.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(custom).not.toHaveBeenCalled();
    });
  });

  suite('handleEvent - jsonParse', () => {
    test('passes event body to safeJsonParse', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.message({ handler });

      const body = '{"action":"test"}';
      const { event, context } = webSocketHandlerEvent({ event: { body } });
      await router.handleEvent(event, context);

      expect(safeJsonParseSpy).toHaveBeenCalledWith(body);
    });

    test('handler receives parsed object when body is valid JSON', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: '{"action":"test","data":42}' },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { action: 'test', data: 42 } }));
    });

    test('handler receives raw string when body is not valid JSON', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: 'not-json' },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: 'not-json' }));
    });
  });

  suite('buildResult (private)', () => {
    test('returns { statusCode: 200 } for undefined response', () => {
      // @ts-expect-error - testing private method
      expect(router.buildResult(undefined)).toEqual({ statusCode: 200 });
    });

    test('returns { statusCode: 200 } for null response', () => {
      // @ts-expect-error - testing private method
      expect(router.buildResult(null)).toEqual({ statusCode: 200 });
    });

    test('returns response as-is when it has a numeric statusCode', () => {
      // @ts-expect-error - testing private method
      expect(router.buildResult({ statusCode: 403 })).toEqual({ statusCode: 403 });
    });

    test('returns { statusCode: 200 } for unexpected response shape', () => {
      // @ts-expect-error - testing private method
      expect(router.buildResult('unexpected')).toEqual({ statusCode: 200 });
    });

    test('warns when an unexpected response shape defaults to { statusCode: 200 }', () => {
      const warnSpy: MockInstance = vi.spyOn(base.getLogger(), 'warn');

      // @ts-expect-error - testing private method
      router.buildResult('unexpected');

      expect(warnSpy).toHaveBeenCalledOnce();
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ webSocketHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: WebSocketRequest, next: WebSocketNext): Promise<WebSocketConnectResponse> {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      }

      const router = createWebSocketRouter({ middleware: [middleware] });
      router.message({
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = webSocketHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to short-circuit by returning a response', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingMiddleware(
        _request: WebSocketRequest,
        _next: WebSocketNext,
      ): Promise<WebSocketConnectResponse> {
        return { statusCode: 403 };
      }

      const router = createWebSocketRouter({ middleware: [blockingMiddleware] });
      router.message({ handler });

      const { event, context } = webSocketHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 403 });
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ webSocketHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: WebSocketRequest, next: WebSocketNext): Promise<WebSocketConnectResponse> {
        callOrder.push('mw1');
        return next(request);
      }

      async function middlewareTwo(request: WebSocketRequest, next: WebSocketNext): Promise<WebSocketConnectResponse> {
        callOrder.push('mw2');
        return next(request);
      }

      const router = createWebSocketRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.message({
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = webSocketHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });

    test('catches a response thrown from within the middleware chain', async ({ webSocketHandlerEvent }) => {
      async function throwingMiddleware(
        _request: WebSocketRequest,
        _next: WebSocketNext,
      ): Promise<WebSocketConnectResponse> {
        throw { statusCode: 401 };
      }

      const router = createWebSocketRouter({ middleware: [throwingMiddleware] });
      router.message({ handler: vi.fn() });

      const { event, context } = webSocketHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 401 });
    });

    test('does not execute middleware when body validation fails', async ({ webSocketHandlerEvent }) => {
      const middleware = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const router = createWebSocketRouter({ middleware: [middleware] });
      router.message({ bodySchema, handler: vi.fn() });

      const { event, context } = webSocketHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('Body validation failed for WebSocket body');
      expect(middleware).not.toHaveBeenCalled();
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware from a message route', async ({ webSocketHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(
        request: WebSocketRequest,
        next: WebSocketNext,
      ): Promise<WebSocketConnectResponse> {
        callOrder.push('route-mw');
        return next(request);
      }

      router.message({
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = webSocketHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('supports middleware on the defineWebSocketRoute builder pattern', async ({ webSocketHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(
        request: WebSocketRequest,
        next: WebSocketNext,
      ): Promise<WebSocketConnectResponse> {
        callOrder.push('route-mw');
        return next(request);
      }

      router.route(
        defineWebSocketRoute({ filters: { eventType: 'MESSAGE' }, middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = webSocketHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ webSocketHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(
        request: WebSocketRequest,
        next: WebSocketNext,
      ): Promise<WebSocketConnectResponse> {
        callOrder.push('router-mw');
        return next(request);
      }

      async function routeMiddleware(
        request: WebSocketRequest,
        next: WebSocketNext,
      ): Promise<WebSocketConnectResponse> {
        callOrder.push('route-mw');
        return next(request);
      }

      const router = createWebSocketRouter({ middleware: [routerMiddleware] });
      router.message({
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = webSocketHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });
  });
});
