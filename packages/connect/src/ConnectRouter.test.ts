import { createConnectEvent, test } from '@lambda-event-router/testing';

import { ConnectRouter, createConnectRouter, defineRoute } from './ConnectRouter.js';
import type { ConnectRequest, ConnectResponse } from './types.js';

type ConnectNext = (request: ConnectRequest) => Promise<ConnectResponse>;

let router: ConnectRouter;

beforeEach(() => {
  router = new ConnectRouter();
});

suite('createConnectRouter', () => {
  test('returns an ConnectRouter instance', () => {
    const router = createConnectRouter();

    expect(router).toBeInstanceOf(ConnectRouter);
  });
});

suite('canHandleEvent', () => {
  test('returns true for a valid ConnectContactFlowEvent', ({ connectEvent }) => {
    const event = connectEvent();

    const result = router.canHandleEvent(event);

    expect(result).toBe(true);
  });

  test('returns false when Name is not ContactFlowEvent', ({ connectEvent }) => {
    const event = connectEvent();
    // @ts-expect-error - testing invalid event
    event.Name = 'SomeOtherEvent';

    const result = router.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false for non-object events', () => {
    expect(router.canHandleEvent(null)).toBe(false);
    expect(router.canHandleEvent('string')).toBe(false);
  });

  test('returns false when Details is missing', () => {
    const event = { Name: 'ContactFlowEvent' };

    const result = router.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false when Details.ContactData is missing', () => {
    const event = { Name: 'ContactFlowEvent', Details: { Parameters: {} } };

    const result = router.canHandleEvent(event);

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
    const customFilter = vi.fn();
    const definition = defineRoute({
      filters: {
        channel: 'CHAT',
        initiationMethod: 'INBOUND',
        instanceArn: 'arn:aws:connect:us-east-1:123456789012:instance/abc',
        customFilter,
      },
    }).handle(handler);

    expect(definition.filters).toEqual({
      channel: 'CHAT',
      initiationMethod: 'INBOUND',
      instanceArn: 'arn:aws:connect:us-east-1:123456789012:instance/abc',
      customFilter,
    });
  });
});

suite('route', () => {
  test('returns this for chaining', () => {
    const handler = vi.fn();

    const result = router.route({ filters: { channel: 'VOICE' }, handler });

    expect(result).toBe(router);
  });
});

suite('matchRoute', () => {
  test('matches when channel is in the channel filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { channel: 'VOICE' }, handler });
    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when channel is in the channel filter array', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { channel: ['VOICE', 'CHAT'] }, handler });
    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when channel is not in the channel filter', async ({ connectEvent }) => {
    router.route({ filters: { channel: 'CHAT' }, handler: vi.fn() });
    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when initiation method is in the initiationMethod filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { initiationMethod: 'INBOUND' }, handler });
    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'INBOUND' } } });

    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when initiation method is in the initiationMethod filter array', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { initiationMethod: ['INBOUND', 'OUTBOUND'] }, handler });
    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'INBOUND' } } });

    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when initiation method is not in the initiationMethod filter', async ({ connectEvent }) => {
    router.route({ filters: { initiationMethod: 'OUTBOUND' }, handler: vi.fn() });
    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'INBOUND' } } });

    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when instance ARN is in the instanceArn filter', async ({ connectEvent }) => {
    const instanceArn = 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123';
    const handler = vi.fn();
    router.route({ filters: { instanceArn: instanceArn }, handler });

    const event = connectEvent({ Details: { ContactData: { InstanceARN: instanceArn } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when instance ARN is in the instanceArn filter array', async ({ connectEvent }) => {
    const instanceArn = 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123';
    const instanceArn2 = 'arn:aws:connect:us-east-1:123456789012:instance/zyx-wvu-987';
    const handler = vi.fn();
    router.route({ filters: { instanceArn: [instanceArn, instanceArn2] }, handler });

    const event = connectEvent({ Details: { ContactData: { InstanceARN: instanceArn } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when instance ARN is not in the instanceArn filter', async ({ connectEvent }) => {
    router.route({
      filters: { instanceArn: 'arn:aws:connect:us-east-1:123456789012:instance/other' },
      handler: vi.fn(),
    });

    const event = connectEvent({
      Details: { ContactData: { InstanceARN: 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123' } },
    });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when a single filter has multiple allowed values', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { channel: ['VOICE', 'CHAT'] }, handler });

    const event = connectEvent({ Details: { ContactData: { Channel: 'CHAT' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when all combined filters match', async ({ connectEvent }) => {
    const instanceArn = 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123';
    const handler = vi.fn();
    router.route({
      filters: { channel: 'VOICE', initiationMethod: 'INBOUND', instanceArn: instanceArn },
      handler,
    });

    const event = connectEvent({
      Details: { ContactData: { Channel: 'VOICE', InitiationMethod: 'INBOUND', InstanceARN: instanceArn } },
    });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when combined filters partially match', async ({ connectEvent }) => {
    router.route({
      filters: { channel: 'VOICE', initiationMethod: 'OUTBOUND' },
      handler: vi.fn(),
    });

    const event = connectEvent({
      Details: { ContactData: { Channel: 'VOICE', InitiationMethod: 'INBOUND' } },
    });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when customFilter returns true', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { customFilter: () => true }, handler });

    const event = connectEvent();
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when async customFilter returns true', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.route({
      filters: {
        customFilter: async (): Promise<boolean> => {
          await new Promise((r) => setTimeout(r, 1));
          return true;
        },
      },
      handler,
    });

    const event = connectEvent();
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when customFilter returns false', async ({ connectEvent }) => {
    router.route({ filters: { customFilter: () => false }, handler: vi.fn() });

    const event = connectEvent();
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('customFilter receives correct input', async ({ connectEvent }) => {
    const customFilter = vi.fn().mockReturnValue(true);
    router.route({ filters: { customFilter }, handler: vi.fn() });

    const event = connectEvent({
      Details: { ContactData: { Channel: 'CHAT', InitiationMethod: 'TRANSFER' } },
    });
    // @ts-expect-error - testing private method
    router.matchRoute(event);

    expect(customFilter).toHaveBeenCalledWith({
      channel: 'CHAT',
      initiationMethod: 'TRANSFER',
      event,
    });
  });

  test('matches any event when filters are empty (catch-all)', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.route({ filters: {}, handler });

    const event = connectEvent();
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('first match wins when multiple routes match', async ({ connectEvent }) => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    router.route({ filters: { channel: 'VOICE' }, handler: firstHandler });
    router.route({ filters: { channel: 'VOICE' }, handler: secondHandler });

    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result?.handler).toBe(firstHandler);
  });
});

suite('channel convenience methods', () => {
  test('returns this for chaining', () => {
    const handler = vi.fn();

    const result = router.voice({ filters: {}, handler });

    expect(result).toBe(router);
  });

  test('voice sets the VOICE channel filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.voice({ filters: {}, handler });
    const event = connectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('chat sets the CHAT channel filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.chat({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { Channel: 'CHAT' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('email sets the EMAIL channel filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.email({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { Channel: 'EMAIL' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });
});

suite('initiation method convenience methods', () => {
  test('inbound sets the INBOUND initiation method filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.inbound({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'INBOUND' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('outbound sets the OUTBOUND initiation method filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.outbound({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'OUTBOUND' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('transfer sets the TRANSFER initiation method filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.transfer({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'TRANSFER' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('callback sets the CALLBACK initiation method filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.callback({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'CALLBACK' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('api sets the API initiation method filter', async ({ connectEvent }) => {
    const handler = vi.fn();
    router.api({ filters: {}, handler });

    const event = connectEvent({ Details: { ContactData: { InitiationMethod: 'API' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });
});

suite('handleEvent', () => {
  test('matched route handler receives correct AmazonConnectRequest', async ({ connectHandlerEvent }) => {
    const handler = vi.fn().mockResolvedValue({ status: 'ok' });
    router.route({ filters: {}, handler });

    const { event, context } = connectHandlerEvent();
    await router.handleEvent(event, context);

    expect(handler).toHaveBeenCalledWith({
      contactData: event.Details.ContactData,
      parameters: event.Details.Parameters,
      event,
      context,
    });
  });

  test('returns the handler result', async ({ connectHandlerEvent }) => {
    const expectedResult = { status: 'success' };
    router.route({ filters: {}, handler: vi.fn().mockResolvedValue(expectedResult) });

    const { event, context } = connectHandlerEvent();
    const result = await router.handleEvent(event, context);

    expect(result).toEqual(expectedResult);
  });

  test('throws when no route matches', async ({ connectHandlerEvent }) => {
    router.route({ filters: { channel: 'CHAT' }, handler: vi.fn() });

    const { event, context } = connectHandlerEvent({
      event: { Details: { ContactData: { Channel: 'VOICE', InitiationMethod: 'INBOUND' } } },
    });
    await expect(router.handleEvent(event, context)).rejects.toThrow(
      'No route matched for Amazon Connect event (channel: VOICE, initiationMethod: INBOUND)',
    );
  });

  test('handler error propagates', async ({ connectHandlerEvent }) => {
    const handlerError = new Error('handler failed');
    router.route({ filters: {}, handler: vi.fn().mockRejectedValue(handlerError) });
    const { event, context } = connectHandlerEvent();

    await expect(router.handleEvent(event, context)).rejects.toThrow('handler failed');
  });
});

suite('full integration', () => {
  test('dispatches to the correct handler based on channel and initiation method', async ({ context }) => {
    const voiceInboundHandler = vi.fn().mockResolvedValue({ result: 'voice-inbound' });
    const chatInboundHandler = vi.fn().mockResolvedValue({ result: 'chat-inbound' });
    const voiceOutboundHandler = vi.fn().mockResolvedValue({ result: 'voice-outbound' });
    router.voice({
      filters: { initiationMethod: 'INBOUND' },
      handler: voiceInboundHandler,
    });
    router.chat({
      filters: { initiationMethod: 'INBOUND' },
      handler: chatInboundHandler,
    });
    router.voice({
      filters: { initiationMethod: 'OUTBOUND' },
      handler: voiceOutboundHandler,
    });

    const chatEvent = createConnectEvent({
      Details: { ContactData: { Channel: 'CHAT', InitiationMethod: 'INBOUND' } },
    });
    const mockContext = context();

    const result = await router.handleEvent(chatEvent, mockContext);

    expect(result).toEqual({ result: 'chat-inbound' });
    expect(voiceInboundHandler).not.toHaveBeenCalled();
    expect(chatInboundHandler).toHaveBeenCalledOnce();
    expect(voiceOutboundHandler).not.toHaveBeenCalled();
  });
});

suite('router-level middleware', () => {
  test('executes middleware before the route handler', async ({ connectHandlerEvent }) => {
    const callOrder: string[] = [];

    async function middleware(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('mw-pre');
      const result = await next(request);
      callOrder.push('mw-post');
      return result;
    }

    const router = createConnectRouter({ middleware: [middleware] });
    router.route({
      filters: {},
      handler: async () => {
        callOrder.push('handler');
        return {};
      },
    });

    const { event, context } = connectHandlerEvent();
    await router.handleEvent(event, context);

    expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
  });

  test('allows middleware to skip a record by not calling next', async ({ connectHandlerEvent }) => {
    const handler = vi.fn();

    async function skipMiddleware(_request: ConnectRequest, _next: ConnectNext): Promise<ConnectResponse> {
      return {};
    }

    const router = createConnectRouter({ middleware: [skipMiddleware] });
    router.route({ filters: {}, handler });

    const { event, context } = connectHandlerEvent();
    await router.handleEvent(event, context);

    expect(handler).not.toHaveBeenCalled();
  });

  test('executes multiple router-level middleware in order', async ({ connectHandlerEvent }) => {
    const callOrder: string[] = [];

    async function middlewareOne(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('mw1');
      return next(request);
    }

    async function middlewareTwo(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('mw2');
      return next(request);
    }

    const router = createConnectRouter({ middleware: [middlewareOne, middlewareTwo] });
    router.route({
      filters: {},
      handler: async () => {
        callOrder.push('handler');
        return {};
      },
    });

    const { event, context } = connectHandlerEvent();
    await router.handleEvent(event, context);

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

    router.route({
      filters: {},
      middleware: [routeMiddleware],
      handler: async () => {
        callOrder.push('handler');
        return {};
      },
    });

    const { event, context } = connectHandlerEvent();
    await router.handleEvent(event, context);

    expect(callOrder).toEqual(['route-mw', 'handler']);
  });

  test('allows route-level middleware to short-circuit by not calling next', async ({ connectHandlerEvent }) => {
    const handler = vi.fn();

    async function blockingRouteMiddleware(_request: ConnectRequest, _next: ConnectNext): Promise<ConnectResponse> {
      return {};
    }

    router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

    const { event, context } = connectHandlerEvent();
    await router.handleEvent(event, context);

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

    router.route({
      filters: {},
      middleware: [routeMiddlewareOne, routeMiddlewareTwo],
      handler: async () => {
        callOrder.push('handler');
        return {};
      },
    });

    const { event, context } = connectHandlerEvent();
    await router.handleEvent(event, context);

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

    router.route(route);

    const { event, context } = connectHandlerEvent();
    await router.handleEvent(event, context);

    expect(callOrder).toEqual(['route-mw', 'handler']);
  });
});

suite('combined router and route middleware', () => {
  test('executes router middleware before route middleware', async ({ connectHandlerEvent }) => {
    const callOrder: string[] = [];

    async function routerMiddleware(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('router-mw');
      return next(request);
    }

    async function routeMiddleware(request: ConnectRequest, next: ConnectNext): Promise<ConnectResponse> {
      callOrder.push('route-mw');
      return next(request);
    }

    const router = createConnectRouter({ middleware: [routerMiddleware] });
    router.route({
      filters: {},
      middleware: [routeMiddleware],
      handler: async () => {
        callOrder.push('handler');
        return {};
      },
    });

    const { event, context } = connectHandlerEvent();
    await router.handleEvent(event, context);

    expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
  });

  test('router middleware short-circuit prevents route middleware from running', async ({ connectHandlerEvent }) => {
    const routeMiddleware = vi.fn();
    const handler = vi.fn();

    async function blockingRouterMiddleware(_request: ConnectRequest, _next: ConnectNext): Promise<ConnectResponse> {
      return {};
    }

    const router = createConnectRouter({ middleware: [blockingRouterMiddleware] });
    router.route({ filters: {}, middleware: [routeMiddleware], handler });

    const { event, context } = connectHandlerEvent();
    await router.handleEvent(event, context);

    expect(routeMiddleware).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});
