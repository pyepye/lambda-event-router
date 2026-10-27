import type { MockInstance } from 'vitest';

import * as base from '@latcher/base';
import { Unauthorized } from '@latcher/http';
import { allEventBuilders, createMockSchema, createWebSocketEvent, test } from '@latcher/testing';

import { WebSocketForbidden } from './response.js';
import type { WebSocketConnectResponse, WebSocketFilterInput, WebSocketRequest } from './types.js';
import { createWebSocketMatcher, defineWebSocketRoute, WebSocketMatcher } from './WebSocketMatcher.js';

type WebSocketNext = (request: WebSocketRequest) => Promise<WebSocketConnectResponse>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');
const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');

suite('WebSocketMatcher', () => {
  let matcher: WebSocketMatcher;

  beforeEach(() => {
    matcher = new WebSocketMatcher();
  });

  suite('createWebSocketMatcher', () => {
    test('creates a WebSocketMatcher instance', () => {
      const matcher = createWebSocketMatcher();
      expect(matcher).toBeInstanceOf(WebSocketMatcher);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid WebSocket event', () => {
      const event = createWebSocketEvent();
      expect(matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(matcher.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(matcher.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for a number', () => {
      expect(matcher.canHandleEvent(42)).toBe(false);
    });

    test('returns false for an array', () => {
      expect(matcher.canHandleEvent([1, 2, 3])).toBe(false);
    });

    test('returns false when event has rawPath (HTTP event, not WebSocket)', () => {
      const event = {
        rawPath: '/items',
        requestContext: { connectionId: 'abc', eventType: 'MESSAGE', routeKey: '$default' },
      };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext is missing', () => {
      const event = { body: 'hello' };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when requestContext is not an object', () => {
      const event = { requestContext: 'bad' };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when connectionId is missing', () => {
      const event = { requestContext: { eventType: 'MESSAGE', routeKey: '$default' } };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when connectionId is not a string', () => {
      const event = { requestContext: { connectionId: 123, eventType: 'MESSAGE', routeKey: '$default' } };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when eventType is missing', () => {
      const event = { requestContext: { connectionId: 'abc', routeKey: '$default' } };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when eventType is not a string', () => {
      const event = { requestContext: { connectionId: 'abc', eventType: 42, routeKey: '$default' } };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when routeKey is missing', () => {
      const event = { requestContext: { connectionId: 'abc', eventType: 'MESSAGE' } };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when routeKey is not a string', () => {
      const event = { requestContext: { connectionId: 'abc', eventType: 'MESSAGE', routeKey: 99 } };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });
  });

  suite('route (chaining)', () => {
    test('returns the matcher instance for chaining', () => {
      const definition = defineWebSocketRoute({
        filters: { eventType: 'MESSAGE' },
      }).handle(async () => undefined);

      const result = matcher.route(definition);

      expect(result).toBe(matcher);
    });
  });

  suite('connect / disconnect / message (chaining)', () => {
    test('connect returns the matcher instance for chaining', () => {
      const result = matcher.connect({ handler: async () => ({ statusCode: 200 }) });
      expect(result).toBe(matcher);
    });

    test('disconnect returns the matcher instance for chaining', () => {
      const result = matcher.disconnect({ handler: async () => {} });
      expect(result).toBe(matcher);
    });

    test('message returns the matcher instance for chaining', () => {
      const result = matcher.message({ handler: async () => {} });
      expect(result).toBe(matcher);
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
      matcher.connect({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { requestContext: { eventType: 'CONNECT', routeKey: '$connect' } },
      });
      const result = await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ statusCode: 200 });
    });

    test('calls matched DISCONNECT handler and returns { statusCode: 200 }', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      matcher.disconnect({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { requestContext: { eventType: 'DISCONNECT', routeKey: '$disconnect' } },
      });
      const result = await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ statusCode: 200 });
    });

    test('calls matched MESSAGE handler and returns { statusCode: 200 }', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      matcher.message({ handler });

      const { event, context } = webSocketHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ statusCode: 200 });
    });

    test('throws when no route matches', async ({ webSocketHandlerEvent }) => {
      const { event, context } = webSocketHandlerEvent({
        event: { requestContext: { eventType: 'MESSAGE', routeKey: 'unknown' } },
      });

      await expect(matcher.handleEvent(event, context)).rejects.toThrow(
        'No route matched for WebSocket event (eventType: MESSAGE, routeKey: unknown)',
      );
    });

    test('passes connectionId, domainName, stage, eventType, routeKey to handler', async ({
      webSocketHandlerEvent,
    }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      matcher.message({ handler });

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
      await matcher.handleEvent(event, context);

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
      matcher.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { queryStringParameters: { token: 'abc123' } },
      });
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ queryStringParameters: { token: 'abc123' } }));
    });

    test('passes event and context on the request object', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      matcher.message({ handler });

      const { event, context } = webSocketHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ event, context }));
    });

    test('passes parsed JSON body to MESSAGE handler', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      matcher.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: '{"action":"test","data":42}' },
      });
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { action: 'test', data: 42 } }));
    });

    test('returns raw string body when JSON parsing fails', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      matcher.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: 'not-json' },
      });
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: 'not-json' }));
    });

    test('returns undefined body when body is absent', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      matcher.message({ handler });

      const { event, context } = webSocketHandlerEvent({ event: { body: '' } });
      // Empty string body is treated as falsy by parseBody
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: undefined }));
    });

    test('validates body against schema when provided', async ({ webSocketHandlerEvent }) => {
      const bodySchema = createMockSchema();
      const handler = vi.fn().mockResolvedValue(undefined);
      matcher.message({ bodySchema, handler });

      const body = JSON.stringify({ action: 'test' });
      const { event, context } = webSocketHandlerEvent({
        event: { body },
      });
      await matcher.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith({ action: 'test' }, bodySchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { action: 'test' } }));
    });

    test('throws "Body validation failed" and does not call handler when schema validation fails', async ({
      webSocketHandlerEvent,
    }) => {
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      const handler = vi.fn();
      matcher.message({ bodySchema, handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: '{"bad":"data"}' },
      });

      await expect(matcher.handleEvent(event, context)).rejects.toThrow('Body validation failed');
      expect(handler).not.toHaveBeenCalled();
    });

    test('catches error with statusCode property and returns it', async ({ webSocketHandlerEvent }) => {
      matcher.message({
        handler: async () => {
          throw { statusCode: 403 };
        },
      });

      const { event, context } = webSocketHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 403 });
    });

    test('catches a thrown WebSocket helper without warning', async ({ webSocketHandlerEvent }) => {
      const warnSpy: MockInstance = vi.spyOn(base.getLogger(), 'warn');
      matcher.message({
        handler: async () => {
          throw WebSocketForbidden();
        },
      });

      const { event, context } = webSocketHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 403 });
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('catches a thrown HTTP helper, keeps its status code and warns', async ({ webSocketHandlerEvent }) => {
      const warnSpy: MockInstance = vi.spyOn(base.getLogger(), 'warn');
      matcher.message({
        handler: async () => {
          throw Unauthorized();
        },
      });

      const { event, context } = webSocketHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 401 });
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('WebSocketUnauthorized');
      warnSpy.mockRestore();
    });

    test('re-throws errors without statusCode', async ({ webSocketHandlerEvent }) => {
      matcher.message({
        handler: async () => {
          throw new Error('unexpected error');
        },
      });

      const { event, context } = webSocketHandlerEvent();

      await expect(matcher.handleEvent(event, context)).rejects.toThrow('unexpected error');
    });

    test('handler returning undefined normalizes to { statusCode: 200 }', async ({ webSocketHandlerEvent }) => {
      matcher.message({ handler: async () => undefined });

      const { event, context } = webSocketHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 200 });
    });

    test('handler returning { statusCode: number } passes through', async ({ webSocketHandlerEvent }) => {
      matcher.connect({ handler: async () => ({ statusCode: 403 }) });

      const { event, context } = webSocketHandlerEvent({
        event: { requestContext: { eventType: 'CONNECT', routeKey: '$connect' } },
      });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 403 });
    });
  });

  suite('matchRoute (private)', () => {
    test('matches route with matching eventType', async () => {
      matcher.connect({ handler: async () => ({ statusCode: 200 }) });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'CONNECT', routeKey: '$connect' });

      expect(result).toBeDefined();
    });

    test('does not match route with different eventType', async () => {
      matcher.connect({ handler: async () => ({ statusCode: 200 }) });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result).toBeUndefined();
    });

    test('matches route with matching routeKey', async () => {
      matcher.message({ filters: { routeKey: 'sendMessage' }, handler: async () => {} });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeDefined();
    });

    test('does not match when routeKey is an empty string', async () => {
      matcher.message({ filters: { routeKey: '' }, handler: async () => {} });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeUndefined();
    });

    test('does not match route with different routeKey', async () => {
      matcher.message({ filters: { routeKey: 'sendMessage' }, handler: async () => {} });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: 'otherAction' });

      expect(result).toBeUndefined();
    });

    test('route without eventType filter matches any eventType', async () => {
      const definition = defineWebSocketRoute({ filters: {} }).handle(async () => undefined);
      matcher.route(definition);

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'DISCONNECT', routeKey: '$disconnect' });

      expect(result).toBeDefined();
    });

    test('route without routeKey filter matches any routeKey', async () => {
      matcher.message({ handler: async () => {} });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: 'anyRoute' });

      expect(result).toBeDefined();
    });

    test('route without any filters matches everything', async () => {
      const definition = defineWebSocketRoute({ filters: {} }).handle(async () => undefined);
      matcher.route(definition);

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'CONNECT', routeKey: '$connect' });

      expect(result).toBeDefined();
    });

    test('returns first matching route when multiple match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      matcher.message({ handler: firstHandler });
      matcher.message({ handler: secondHandler });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result?.handler).toBe(firstHandler);
    });

    test('orders a narrower route ahead of a broader one registered first', async () => {
      const broad = vi.fn();
      const narrow = vi.fn();
      matcher.route({ filters: { eventType: 'MESSAGE' }, handler: broad });
      matcher.route({ filters: { eventType: 'MESSAGE', routeKey: '$default' }, handler: narrow });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result?.handler).toBe(narrow);
    });

    test('orders a guarded route ahead of the fallback it shares filters with', async () => {
      const fallback = vi.fn();
      const guarded = vi.fn();
      matcher.route({ filters: { eventType: 'MESSAGE' }, handler: fallback });
      matcher.route({ filters: { eventType: 'MESSAGE', custom: () => true }, handler: guarded });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result?.handler).toBe(guarded);
    });

    test('matches route by custom', async () => {
      matcher.route(
        defineWebSocketRoute({
          filters: {
            custom: ({ routeKey }: WebSocketFilterInput): boolean => routeKey === 'sendMessage',
          },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeDefined();
    });

    test('matches route by custom', async () => {
      matcher.route(
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
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeDefined();
    });

    test('does not match route when custom returns false', async () => {
      matcher.route(
        defineWebSocketRoute({
          filters: {
            custom: (): boolean => false,
          },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result).toBeUndefined();
    });

    test('passes correct filterInput to custom', async ({ context }) => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.route(
        defineWebSocketRoute({
          filters: { custom },
        }).handle(async () => ({ statusCode: 200 })),
      );
      const event = createWebSocketEvent({
        requestContext: { eventType: 'MESSAGE', routeKey: 'sendMessage' },
        body: JSON.stringify({ action: 'sendMessage', content: 'hello' }),
      });

      await matcher.handleEvent(event, context());

      expect(custom).toHaveBeenCalledWith({
        eventType: 'MESSAGE',
        routeKey: 'sendMessage',
        body: { action: 'sendMessage', content: 'hello' },
        event,
      });
    });

    test('routes on a field inside the frame', async ({ context }) => {
      const urgentHandler = vi.fn().mockResolvedValue(undefined);
      const routineHandler = vi.fn().mockResolvedValue(undefined);

      matcher
        .route(
          defineWebSocketRoute({
            filters: {
              eventType: 'MESSAGE',
              custom: ({ body }: WebSocketFilterInput): boolean => base.isObject(body) && body.priority === 'urgent',
            },
          }).handle(urgentHandler),
        )
        .message({ handler: routineHandler });

      const urgent = createWebSocketEvent({
        requestContext: { eventType: 'MESSAGE', routeKey: 'send' },
        body: JSON.stringify({ priority: 'urgent' }),
      });
      const routine = createWebSocketEvent({
        requestContext: { eventType: 'MESSAGE', routeKey: 'send' },
        body: JSON.stringify({ priority: 'routine' }),
      });

      await matcher.handleEvent(urgent, context());
      await matcher.handleEvent(routine, context());

      expect(urgentHandler).toHaveBeenCalledTimes(1);
      expect(routineHandler).toHaveBeenCalledTimes(1);
    });

    test('matches when standard filters and custom both pass', async () => {
      matcher.route(
        defineWebSocketRoute({
          filters: {
            eventType: 'MESSAGE',
            custom: ({ routeKey }: WebSocketFilterInput): boolean => routeKey === 'sendMessage',
          },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeDefined();
    });

    test('does not match when standard filters pass but custom returns false', async () => {
      matcher.route(
        defineWebSocketRoute({
          filters: {
            eventType: 'MESSAGE',
            custom: (): boolean => false,
          },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(result).toBeUndefined();
    });

    test('custom is not called when an earlier filter fails', async () => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.route(
        defineWebSocketRoute({
          filters: {
            eventType: 'CONNECT',
            custom,
          },
        }).handle(async () => ({ statusCode: 200 })),
      );

      // @ts-expect-error - testing private method
      matcher.matchRoute({ eventType: 'MESSAGE', routeKey: '$default' });

      expect(custom).not.toHaveBeenCalled();
    });
  });

  suite('custom on every registration path', () => {
    test('route() takes a custom without wrapping in defineWebSocketRoute', async () => {
      matcher.route({
        filters: {
          eventType: 'MESSAGE',
          custom: ({ routeKey }: WebSocketFilterInput): boolean => routeKey === 'sendMessage',
        },
        handler: async () => undefined,
      });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeDefined();
    });

    test('route() does not match when its custom returns false', async () => {
      matcher.route({
        filters: { eventType: 'MESSAGE', custom: (): boolean => false },
        handler: async () => undefined,
      });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });

      expect(result).toBeUndefined();
    });

    test('connect() takes a custom alongside its pinned eventType', async ({ context }) => {
      const tokenHandler = vi.fn().mockResolvedValue(undefined);
      const anonymousHandler = vi.fn().mockResolvedValue(undefined);

      matcher
        .connect({
          filters: {
            custom: ({ event }: WebSocketFilterInput): boolean => Boolean(event.queryStringParameters?.token),
          },
          handler: tokenHandler,
        })
        .connect({ handler: anonymousHandler });

      const withToken = createWebSocketEvent({
        requestContext: { eventType: 'CONNECT', routeKey: '$connect' },
        queryStringParameters: { token: 'abc' },
      });
      const withoutToken = createWebSocketEvent({
        requestContext: { eventType: 'CONNECT', routeKey: '$connect' },
      });

      await matcher.handleEvent(withToken, context());
      await matcher.handleEvent(withoutToken, context());

      expect(tokenHandler).toHaveBeenCalledTimes(1);
      expect(anonymousHandler).toHaveBeenCalledTimes(1);
    });

    test('disconnect() takes a custom alongside its pinned eventType', async () => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.disconnect({ filters: { custom }, handler: async () => {} });

      // @ts-expect-error - testing private method
      const result = await matcher.matchRoute({ eventType: 'DISCONNECT', routeKey: '$disconnect' });

      expect(result).toBeDefined();
      expect(custom).toHaveBeenCalled();
    });

    test('message() takes routeKey and custom together inside filters', async ({ context }) => {
      const urgentHandler = vi.fn().mockResolvedValue(undefined);
      const routineHandler = vi.fn().mockResolvedValue(undefined);

      matcher
        .message({
          filters: {
            routeKey: 'send',
            custom: ({ body }: WebSocketFilterInput): boolean => base.isObject(body) && body.priority === 'urgent',
          },
          handler: urgentHandler,
        })
        .message({ filters: { routeKey: 'send' }, handler: routineHandler });

      const urgent = createWebSocketEvent({
        requestContext: { eventType: 'MESSAGE', routeKey: 'send' },
        body: JSON.stringify({ priority: 'urgent' }),
      });
      const routine = createWebSocketEvent({
        requestContext: { eventType: 'MESSAGE', routeKey: 'send' },
        body: JSON.stringify({ priority: 'routine' }),
      });

      await matcher.handleEvent(urgent, context());
      await matcher.handleEvent(routine, context());

      expect(urgentHandler).toHaveBeenCalledTimes(1);
      expect(routineHandler).toHaveBeenCalledTimes(1);
    });

    test('message() routeKey inside filters still narrows to that route key', async () => {
      const handler = vi.fn();
      matcher.message({ filters: { routeKey: 'sendMessage' }, handler });

      // @ts-expect-error - testing private method
      const matched = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: 'sendMessage' });
      // @ts-expect-error - testing private method
      const unmatched = await matcher.matchRoute({ eventType: 'MESSAGE', routeKey: 'other' });

      expect(matched?.handler).toBe(handler);
      expect(unmatched).toBeUndefined();
    });
  });

  suite('handleEvent - jsonParse', () => {
    test('passes event body to safeJsonParse', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      matcher.message({ handler });

      const body = '{"action":"test"}';
      const { event, context } = webSocketHandlerEvent({ event: { body } });
      await matcher.handleEvent(event, context);

      expect(safeJsonParseSpy).toHaveBeenCalledWith(body);
    });

    test('handler receives parsed object when body is valid JSON', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      matcher.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: '{"action":"test","data":42}' },
      });
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { action: 'test', data: 42 } }));
    });

    test('handler receives raw string when body is not valid JSON', async ({ webSocketHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      matcher.message({ handler });

      const { event, context } = webSocketHandlerEvent({
        event: { body: 'not-json' },
      });
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: 'not-json' }));
    });
  });

  suite('buildResult (private)', () => {
    test('returns { statusCode: 200 } for undefined response', () => {
      // @ts-expect-error - testing private method
      expect(matcher.buildResult(undefined)).toEqual({ statusCode: 200 });
    });

    test('returns { statusCode: 200 } for null response', () => {
      // @ts-expect-error - testing private method
      expect(matcher.buildResult(null)).toEqual({ statusCode: 200 });
    });

    test('returns response as-is when it has a numeric statusCode', () => {
      // @ts-expect-error - testing private method
      expect(matcher.buildResult({ statusCode: 403 })).toEqual({ statusCode: 403 });
    });

    test('returns { statusCode: 200 } for unexpected response shape', () => {
      // @ts-expect-error - testing private method
      expect(matcher.buildResult('unexpected')).toEqual({ statusCode: 200 });
    });

    test('warns when an unexpected response shape defaults to { statusCode: 200 }', () => {
      const warnSpy: MockInstance = vi.spyOn(base.getLogger(), 'warn');

      // @ts-expect-error - testing private method
      matcher.buildResult('unexpected');

      expect(warnSpy).toHaveBeenCalledOnce();
    });
  });

  suite('matcher-level middleware', () => {
    test('executes middleware before the route handler', async ({ webSocketHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: WebSocketRequest, next: WebSocketNext): Promise<WebSocketConnectResponse> {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      }

      const matcher = createWebSocketMatcher({ middleware: [middleware] });
      matcher.message({
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = webSocketHandlerEvent();
      await matcher.handleEvent(event, context);

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

      const matcher = createWebSocketMatcher({ middleware: [blockingMiddleware] });
      matcher.message({ handler });

      const { event, context } = webSocketHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 403 });
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple matcher-level middleware in order', async ({ webSocketHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: WebSocketRequest, next: WebSocketNext): Promise<WebSocketConnectResponse> {
        callOrder.push('mw1');
        return next(request);
      }

      async function middlewareTwo(request: WebSocketRequest, next: WebSocketNext): Promise<WebSocketConnectResponse> {
        callOrder.push('mw2');
        return next(request);
      }

      const matcher = createWebSocketMatcher({ middleware: [middlewareOne, middlewareTwo] });
      matcher.message({
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = webSocketHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });

    test('catches a response thrown from within the middleware chain', async ({ webSocketHandlerEvent }) => {
      async function throwingMiddleware(
        _request: WebSocketRequest,
        _next: WebSocketNext,
      ): Promise<WebSocketConnectResponse> {
        throw { statusCode: 401 };
      }

      const matcher = createWebSocketMatcher({ middleware: [throwingMiddleware] });
      matcher.message({ handler: vi.fn() });

      const { event, context } = webSocketHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ statusCode: 401 });
    });

    test('does not execute middleware when body validation fails', async ({ webSocketHandlerEvent }) => {
      const middleware = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const matcher = createWebSocketMatcher({ middleware: [middleware] });
      matcher.message({ bodySchema, handler: vi.fn() });

      const { event, context } = webSocketHandlerEvent();
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('Body validation failed for WebSocket body');
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

      matcher.message({
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = webSocketHandlerEvent();
      await matcher.handleEvent(event, context);

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

      matcher.route(
        defineWebSocketRoute({ filters: { eventType: 'MESSAGE' }, middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = webSocketHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined matcher and route middleware', () => {
    test('executes matcher middleware before route middleware', async ({ webSocketHandlerEvent }) => {
      const callOrder: string[] = [];

      async function matcherMiddleware(
        request: WebSocketRequest,
        next: WebSocketNext,
      ): Promise<WebSocketConnectResponse> {
        callOrder.push('matcher-mw');
        return next(request);
      }

      async function routeMiddleware(
        request: WebSocketRequest,
        next: WebSocketNext,
      ): Promise<WebSocketConnectResponse> {
        callOrder.push('route-mw');
        return next(request);
      }

      const matcher = createWebSocketMatcher({ middleware: [matcherMiddleware] });
      matcher.message({
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = webSocketHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });
  });
});

suite('WebSocketMatcher.canHandleEvent', () => {
  const ownEvents = ['createWebSocketEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createWebSocketMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
