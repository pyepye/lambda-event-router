import { allEventBuilders, createConnectEvent, test } from '@latcher/testing';

import { ConnectMatcher, createConnectMatcher, defineRoute } from './ConnectMatcher.js';
import type { ConnectEvent, ConnectRequest, ConnectResponse } from './types.js';

type ConnectNext = (request: ConnectRequest) => Promise<ConnectResponse>;

let matcher: ConnectMatcher;

beforeEach(() => {
  matcher = new ConnectMatcher();
});

suite('createConnectMatcher', () => {
  test('returns an ConnectMatcher instance', () => {
    const matcher = createConnectMatcher();

    expect(matcher).toBeInstanceOf(ConnectMatcher);
  });
});

suite('canHandleEvent', () => {
  test('returns true for a valid ConnectContactFlowEvent', ({ connectEvent }) => {
    const event = connectEvent();

    const result = matcher.canHandleEvent(event);

    expect(result).toBe(true);
  });

  test('returns false when Name is not ContactFlowEvent', ({ connectEvent }) => {
    const event = connectEvent();
    // @ts-expect-error - testing invalid event
    event.Name = 'SomeOtherEvent';

    const result = matcher.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false for non-object events', () => {
    expect(matcher.canHandleEvent(null)).toBe(false);
    expect(matcher.canHandleEvent('string')).toBe(false);
  });

  test('returns false when Details is missing', () => {
    const event = { Name: 'ContactFlowEvent' };

    const result = matcher.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false when Details.ContactData is missing', () => {
    const event = { Name: 'ContactFlowEvent', Details: { Parameters: {} } };

    const result = matcher.canHandleEvent(event);

    expect(result).toBe(false);
  });
});

suite('defineRoute', () => {
  test('creates a route definition with filters and handler', () => {
    const handler = vi.fn();

    const definition = defineRoute({ filters: { channel: 'VOICE' } }).handle(handler);

    expect(definition).toEqual({
      filters: { channel: 'VOICE' },
      middleware: [],
      handler,
    });
  });

  test('preserves filter configuration', () => {
    const handler = vi.fn();
    const custom = vi.fn();
    const definition = defineRoute({
      filters: {
        channel: 'CHAT',
        initiationMethod: 'INBOUND',
        instanceArn: 'arn:aws:connect:us-east-1:123456789012:instance/abc',
        custom,
      },
    }).handle(handler);

    expect(definition.filters).toEqual({
      channel: 'CHAT',
      initiationMethod: 'INBOUND',
      instanceArn: 'arn:aws:connect:us-east-1:123456789012:instance/abc',
      custom,
    });
  });
});

suite('route', () => {
  test('returns this for chaining', () => {
    const handler = vi.fn();

    const result = matcher.route({ filters: { channel: 'VOICE' }, handler });

    expect(result).toBe(matcher);
  });
});

suite('matchRoute', () => {
  test('matches when channel is in the channel filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { channel: 'VOICE' }, handler });
    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('orders a narrower route ahead of a broader one registered first', async ({ connectEvent }) => {
    const broad = vi.fn();
    const narrow = vi.fn();
    matcher.route({ filters: {}, handler: broad });
    matcher.route({ filters: { channel: 'VOICE' }, handler: narrow });
    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result?.handler).toBe(narrow);
  });

  test('orders a guarded route ahead of the fallback it shares filters with', async ({ connectEvent }) => {
    const fallback = vi.fn();
    const guarded = vi.fn();
    matcher.route({ filters: { channel: 'VOICE' }, handler: fallback });
    matcher.route({ filters: { channel: 'VOICE', custom: () => true }, handler: guarded });
    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result?.handler).toBe(guarded);
  });

  test('matches when channel is in the channel filter array', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { channel: ['VOICE', 'CHAT'] }, handler });
    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when channel is not in the channel filter', async ({ connectEvent }) => {
    matcher.route({ filters: { channel: 'CHAT' }, handler: vi.fn() });
    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when initiation method is in the initiationMethod filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { initiationMethod: 'INBOUND' }, handler });
    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'INBOUND' } } });

    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when initiation method is in the initiationMethod filter array', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { initiationMethod: ['INBOUND', 'OUTBOUND'] }, handler });
    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'INBOUND' } } });

    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when initiation method is not in the initiationMethod filter', async ({ connectEvent }) => {
    matcher.route({ filters: { initiationMethod: 'OUTBOUND' }, handler: vi.fn() });
    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'INBOUND' } } });

    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when instance ARN is in the instanceArn filter', async ({ connectEvent }) => {
    const instanceArn = 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123';
    const handler = vi.fn();
    matcher.route({ filters: { instanceArn: instanceArn }, handler });

    const event = connectEvent({ Details: { ContactData: { InstanceARN: instanceArn } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when instanceArn is an empty string', async ({ connectEvent }) => {
    const instanceArn = 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123';
    matcher.route({ filters: { instanceArn: '' }, handler: vi.fn() });

    const event = connectEvent({ Details: { ContactData: { InstanceARN: instanceArn } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when instance ARN is in the instanceArn filter array', async ({ connectEvent }) => {
    const instanceArn = 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123';
    const instanceArn2 = 'arn:aws:connect:us-east-1:123456789012:instance/zyx-wvu-987';
    const handler = vi.fn();
    matcher.route({ filters: { instanceArn: [instanceArn, instanceArn2] }, handler });

    const event = connectEvent({ Details: { ContactData: { InstanceARN: instanceArn } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when instance ARN is not in the instanceArn filter', async ({ connectEvent }) => {
    matcher.route({
      filters: { instanceArn: 'arn:aws:connect:us-east-1:123456789012:instance/other' },
      handler: vi.fn(),
    });

    const event = connectEvent({
      Details: { ContactData: { InstanceARN: 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123' } },
    });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when a single filter has multiple allowed values', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { channel: ['VOICE', 'CHAT'] }, handler });

    const event = connectEvent({ Details: { ContactData: { Channel: 'CHAT' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when all combined filters match', async ({ connectEvent }) => {
    const instanceArn = 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123';
    const handler = vi.fn();
    matcher.route({
      filters: { channel: 'VOICE', initiationMethod: 'INBOUND', instanceArn: instanceArn },
      handler,
    });

    const event = connectEvent({
      Details: { ContactData: { Channel: 'VOICE', InitiationMethod: 'INBOUND', InstanceARN: instanceArn } },
    });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when combined filters partially match', async ({ connectEvent }) => {
    matcher.route({
      filters: { channel: 'VOICE', initiationMethod: 'OUTBOUND' },
      handler: vi.fn(),
    });

    const event = connectEvent({
      Details: { ContactData: { Channel: 'VOICE', InitiationMethod: 'INBOUND' } },
    });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when custom returns true', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { custom: () => true }, handler });

    const event = connectEvent();
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when async custom returns true', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.route({
      filters: {
        custom: async (): Promise<boolean> => {
          await new Promise((r) => setTimeout(r, 1));
          return true;
        },
      },
      handler,
    });

    const event = connectEvent();
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when custom returns false', async ({ connectEvent }) => {
    matcher.route({ filters: { custom: () => false }, handler: vi.fn() });

    const event = connectEvent();
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('custom receives correct input', async ({ connectEvent }) => {
    const custom = vi.fn().mockReturnValue(true);
    matcher.route({ filters: { custom }, handler: vi.fn() });

    const event = connectEvent({
      Details: { ContactData: { Channel: 'CHAT', InitiationMethod: 'TRANSFER' } },
    });
    // @ts-expect-error - testing private method
    matcher.matchRoute(event);

    expect(custom).toHaveBeenCalledWith({
      channel: 'CHAT',
      initiationMethod: 'TRANSFER',
      event,
    });
  });

  test('matches any event when filters are empty (catch-all)', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: {}, handler });

    const event = connectEvent();
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('first match wins when multiple routes match', async ({ connectEvent }) => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    matcher.route({ filters: { channel: 'VOICE' }, handler: firstHandler });
    matcher.route({ filters: { channel: 'VOICE' }, handler: secondHandler });

    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result?.handler).toBe(firstHandler);
  });
});

suite('channel convenience methods', () => {
  test('returns this for chaining', () => {
    const handler = vi.fn();

    const result = matcher.voice({ filters: {}, handler });

    expect(result).toBe(matcher);
  });

  test('voice sets the VOICE channel filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.voice({ filters: {}, handler });
    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('chat sets the CHAT channel filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.chat({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { Channel: 'CHAT' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('email sets the EMAIL channel filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.email({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { Channel: 'EMAIL' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('task sets the TASK channel filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.task({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { Channel: 'TASK' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });
});

suite('delivered channels and initiation methods', () => {
  // The fixture declares the same unions as types.ts, and cannot import them. This fails to compile
  // if the two drift apart.
  test('a fixture event satisfies ConnectEvent', ({ connectEvent }) => {
    const event: ConnectEvent = connectEvent({
      Details: { ContactData: { Channel: 'TASK', InitiationMethod: 'WEBRTC_API' } },
    });

    expect(event.Details.ContactData.Channel).toBe('TASK');
  });

  test('routes on a channel aws-lambda does not carry', async ({ connectHandlerEvent }) => {
    const handler = vi.fn().mockResolvedValue({ queued: 'true' });
    matcher.route({ filters: { channel: 'TASK' }, handler });
    const { event, context } = connectHandlerEvent({
      event: { Details: { ContactData: { Channel: 'TASK' } } },
    });

    const result = await matcher.handleEvent(event, context);

    expect(result).toEqual({ queued: 'true' });
  });

  test('routes on an initiation method aws-lambda does not carry', async ({ connectHandlerEvent }) => {
    const handler = vi.fn().mockResolvedValue({ connected: 'true' });
    matcher.route({ filters: { initiationMethod: ['WEBRTC_API', 'QUEUE_TRANSFER'] }, handler });
    const { event, context } = connectHandlerEvent({
      event: { Details: { ContactData: { InitiationMethod: 'QUEUE_TRANSFER' } } },
    });

    const result = await matcher.handleEvent(event, context);

    expect(result).toEqual({ connected: 'true' });
  });

  test('names the delivered channel when no route matches', async ({ connectHandlerEvent }) => {
    matcher.chat({ filters: {}, handler: vi.fn() });
    const { event, context } = connectHandlerEvent({
      event: { Details: { ContactData: { Channel: 'TASK', InitiationMethod: 'API' } } },
    });

    await expect(matcher.handleEvent(event, context)).rejects.toThrow(
      'No route matched for Amazon Connect event (channel: TASK, initiationMethod: API)',
    );
  });
});

suite('initiation method convenience methods', () => {
  test('inbound sets the INBOUND initiation method filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.inbound({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'INBOUND' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('outbound sets the OUTBOUND initiation method filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.outbound({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'OUTBOUND' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('transfer sets the TRANSFER initiation method filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.transfer({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'TRANSFER' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('callback sets the CALLBACK initiation method filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.callback({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'CALLBACK' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('api sets the API initiation method filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    matcher.api({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'API' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });
});

suite('handleEvent', () => {
  test('matched route handler receives correct AmazonConnectRequest', async ({ connectHandlerEvent }) => {
    const handler = vi.fn().mockResolvedValue({ status: 'ok' });
    matcher.route({ filters: {}, handler });

    const { event, context } = connectHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(handler).toHaveBeenCalledWith({
      contactData: event.Details.ContactData,
      parameters: event.Details.Parameters,
      event,
      context,
    });
  });

  test('returns the handler result', async ({ connectHandlerEvent }) => {
    const expectedResult = { status: 'success' };
    matcher.route({ filters: {}, handler: vi.fn().mockResolvedValue(expectedResult) });

    const { event, context } = connectHandlerEvent();
    const result = await matcher.handleEvent(event, context);

    expect(result).toEqual(expectedResult);
  });

  test('throws when no route matches', async ({ connectHandlerEvent }) => {
    matcher.route({ filters: { channel: 'CHAT' }, handler: vi.fn() });

    const { event, context } = connectHandlerEvent({
      event: { Details: { ContactData: { Channel: 'VOICE', InitiationMethod: 'INBOUND' } } },
    });
    await expect(matcher.handleEvent(event, context)).rejects.toThrow(
      'No route matched for Amazon Connect event (channel: VOICE, initiationMethod: INBOUND)',
    );
  });

  test('handler error propagates', async ({ connectHandlerEvent }) => {
    const handlerError = new Error('handler failed');
    matcher.route({ filters: {}, handler: vi.fn().mockRejectedValue(handlerError) });
    const { event, context } = connectHandlerEvent();

    await expect(matcher.handleEvent(event, context)).rejects.toThrow('handler failed');
  });
});

suite('full integration', () => {
  test('dispatches to the correct handler based on channel and initiation method', async ({ context }) => {
    const voiceInboundHandler = vi.fn().mockResolvedValue({ result: 'voice-inbound' });
    const chatInboundHandler = vi.fn().mockResolvedValue({ result: 'chat-inbound' });
    const voiceOutboundHandler = vi.fn().mockResolvedValue({ result: 'voice-outbound' });
    matcher.voice({
      filters: { initiationMethod: 'INBOUND' },
      handler: voiceInboundHandler,
    });
    matcher.chat({
      filters: { initiationMethod: 'INBOUND' },
      handler: chatInboundHandler,
    });
    matcher.voice({
      filters: { initiationMethod: 'OUTBOUND' },
      handler: voiceOutboundHandler,
    });

    const chatEvent = createConnectEvent({
      Details: { ContactData: { Channel: 'CHAT', InitiationMethod: 'INBOUND' } },
    });
    const mockContext = context();

    const result = await matcher.handleEvent(chatEvent, mockContext);

    expect(result).toEqual({ result: 'chat-inbound' });
    expect(voiceInboundHandler).not.toHaveBeenCalled();
    expect(chatInboundHandler).toHaveBeenCalledOnce();
    expect(voiceOutboundHandler).not.toHaveBeenCalled();
  });
});

suite('matcher-level middleware', () => {
  test('executes middleware before the route handler', async ({ connectHandlerEvent }) => {
    const callOrder: string[] = [];

    async function middleware(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('mw-pre');
      const result = await next(request);
      callOrder.push('mw-post');
      return result;
    }

    const matcher = createConnectMatcher({ middleware: [middleware] });
    matcher.route({
      filters: {},
      handler: async () => {
        callOrder.push('handler');
        return {};
      },
    });

    const { event, context } = connectHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
  });

  test('allows middleware to skip a record by not calling next', async ({ connectHandlerEvent }) => {
    const handler = vi.fn();

    async function skipMiddleware(_request: ConnectRequest, _next: ConnectNext): Promise<ConnectResponse> {
      return {};
    }

    const matcher = createConnectMatcher({ middleware: [skipMiddleware] });
    matcher.route({ filters: {}, handler });

    const { event, context } = connectHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(handler).not.toHaveBeenCalled();
  });

  test('executes multiple matcher-level middleware in order', async ({ connectHandlerEvent }) => {
    const callOrder: string[] = [];

    async function middlewareOne(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('mw1');
      return next(request);
    }

    async function middlewareTwo(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('mw2');
      return next(request);
    }

    const matcher = createConnectMatcher({ middleware: [middlewareOne, middlewareTwo] });
    matcher.route({
      filters: {},
      handler: async () => {
        callOrder.push('handler');
        return {};
      },
    });

    const { event, context } = connectHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
  });
});

suite('route-level middleware', () => {
  test('executes route-level middleware for a specific route', async ({ connectHandlerEvent }) => {
    const callOrder: string[] = [];

    async function routeMiddleware(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('route-mw');
      return next(request);
    }

    matcher.route({
      filters: {},
      middleware: [routeMiddleware],
      handler: async () => {
        callOrder.push('handler');
        return {};
      },
    });

    const { event, context } = connectHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(callOrder).toEqual(['route-mw', 'handler']);
  });

  test('allows route-level middleware to short-circuit by not calling next', async ({ connectHandlerEvent }) => {
    const handler = vi.fn();

    async function blockingRouteMiddleware(_request: ConnectRequest, _next: ConnectNext): Promise<ConnectResponse> {
      return {};
    }

    matcher.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

    const { event, context } = connectHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(handler).not.toHaveBeenCalled();
  });

  test('executes multiple route-level middleware in order', async ({ connectHandlerEvent }) => {
    const callOrder: string[] = [];

    async function routeMiddlewareOne(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('route-mw1');
      return next(request);
    }

    async function routeMiddlewareTwo(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('route-mw2');
      return next(request);
    }

    matcher.route({
      filters: {},
      middleware: [routeMiddlewareOne, routeMiddlewareTwo],
      handler: async () => {
        callOrder.push('handler');
        return {};
      },
    });

    const { event, context } = connectHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
  });

  test('supports middleware on defineRoute builder pattern', async ({ connectHandlerEvent }) => {
    const callOrder: string[] = [];

    async function routeMiddleware(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('route-mw');
      return next(request);
    }

    const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
      callOrder.push('handler');
      return {};
    });

    matcher.route(route);

    const { event, context } = connectHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(callOrder).toEqual(['route-mw', 'handler']);
  });
});

suite('combined matcher and route middleware', () => {
  test('executes matcher middleware before route middleware', async ({ connectHandlerEvent }) => {
    const callOrder: string[] = [];

    async function matcherMiddleware(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('matcher-mw');
      return next(request);
    }

    async function routeMiddleware(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('route-mw');
      return next(request);
    }

    const matcher = createConnectMatcher({ middleware: [matcherMiddleware] });
    matcher.route({
      filters: {},
      middleware: [routeMiddleware],
      handler: async () => {
        callOrder.push('handler');
        return {};
      },
    });

    const { event, context } = connectHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
  });

  test('matcher middleware short-circuit prevents route middleware from running', async ({ connectHandlerEvent }) => {
    const routeMiddleware = vi.fn();
    const handler = vi.fn();

    async function blockingMatcherMiddleware(_request: ConnectRequest, _next: ConnectNext): Promise<ConnectResponse> {
      return {};
    }

    const matcher = createConnectMatcher({ middleware: [blockingMatcherMiddleware] });
    matcher.route({ filters: {}, middleware: [routeMiddleware], handler });

    const { event, context } = connectHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(routeMiddleware).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});

suite('ConnectMatcher.canHandleEvent', () => {
  const ownEvents = ['createConnectEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createConnectMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
