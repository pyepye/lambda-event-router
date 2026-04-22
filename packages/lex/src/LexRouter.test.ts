import type { LexV2Result } from 'aws-lambda';

import { createLexEvent, test } from '@lambda-event-router/testing';

import { createLexRouter, defineRoute, LexRouter } from './LexRouter.js';
import type { LexFilterInput, LexRequest } from './types.js';

type LexNext = (request: LexRequest) => Promise<LexV2Result>;

let router: LexRouter;

beforeEach(() => {
  router = new LexRouter();
});

suite('createLexRouter', () => {
  test('returns an LexRouter instance', () => {
    const router = createLexRouter();

    expect(router).toBeInstanceOf(LexRouter);
  });
});

suite('canHandleEvent', () => {
  test('returns true for a valid LexV2Event', ({ lexEvent }) => {
    const event = lexEvent();

    const result = router.canHandleEvent(event);

    expect(result).toBe(true);
  });

  test('returns false for non-object events', () => {
    expect(router.canHandleEvent(null)).toBe(false);
    expect(router.canHandleEvent('string')).toBe(false);
    expect(router.canHandleEvent(42)).toBe(false);
  });

  test('returns false when sessionState is missing', () => {
    const event = { bot: { id: 'abc' }, interpretations: [], invocationSource: 'DialogCodeHook' };

    const result = router.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false when bot is missing', () => {
    const event = {
      sessionState: { intent: { name: 'test' } },
      interpretations: [],
      invocationSource: 'DialogCodeHook',
    };

    const result = router.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false when bot.id is not a string', () => {
    const event = {
      sessionState: { intent: { name: 'test' } },
      bot: { id: 123 },
      interpretations: [],
      invocationSource: 'DialogCodeHook',
    };

    const result = router.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false when interpretations is not an array', () => {
    const event = {
      sessionState: { intent: { name: 'test' } },
      bot: { id: 'abc' },
      interpretations: 'not-an-array',
      invocationSource: 'DialogCodeHook',
    };

    const result = router.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false when invocationSource is missing', () => {
    const event = {
      sessionState: { intent: { name: 'test' } },
      bot: { id: 'abc' },
      interpretations: [],
    };

    const result = router.canHandleEvent(event);

    expect(result).toBe(false);
  });
});

suite('defineRoute', () => {
  test('creates a route definition with filters and handler', () => {
    const handler = vi.fn();

    const definition = defineRoute({ filters: { intentName: 'OrderPizza' } }).handle(handler);

    expect(definition).toEqual({
      filters: { intentName: 'OrderPizza' },
      middleware: undefined,
      handler,
    });
  });

  test('preserves all filter configuration', () => {
    const handler = vi.fn();
    const customFilter = vi.fn();
    const definition = defineRoute({
      filters: {
        intentName: 'OrderPizza',
        invocationSource: 'DialogCodeHook',
        botId: 'TESTBOTID',
        inputMode: 'Text',
        customFilter,
      },
    }).handle(handler);

    expect(definition.filters).toEqual({
      intentName: 'OrderPizza',
      invocationSource: 'DialogCodeHook',
      botId: 'TESTBOTID',
      inputMode: 'Text',
      customFilter,
    });
  });
});

suite('route', () => {
  test('route, dialogCodeHook and fulfillmentCodeHook return this for chaining', () => {
    const handler = vi.fn();

    const routeResult = router.route({ filters: { intentName: 'OrderPizza' }, handler });
    const dialogResult = router.dialogCodeHook({ filters: {}, handler });
    const fulfillmentResult = router.fulfillmentCodeHook({ filters: {}, handler });

    expect(routeResult).toBe(router);
    expect(dialogResult).toBe(router);
    expect(fulfillmentResult).toBe(router);
  });
});

suite('matchRoute', () => {
  test('matches when intentName is in the intentName filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { intentName: 'CheckBalance' }, handler });

    const event = lexEvent({ sessionState: { intent: { name: 'CheckBalance' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when intentName is in the intentName filter array', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { intentName: ['CheckBalance', 'UpdateBalance'] }, handler });

    const event = lexEvent({ sessionState: { intent: { name: 'CheckBalance' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when intentName is not in the intentName filter', async ({ lexEvent }) => {
    router.route({ filters: { intentName: 'OrderDrink' }, handler: vi.fn() });

    const event = lexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when invocationSource is in the invocationSource filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { invocationSource: 'FulfillmentCodeHook' }, handler });

    const event = lexEvent({ invocationSource: 'FulfillmentCodeHook' });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when invocationSource is in the invocationSource filter array', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { invocationSource: ['FulfillmentCodeHook', 'DialogCodeHook'] }, handler });

    const event = lexEvent({ invocationSource: 'FulfillmentCodeHook' });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when invocationSource is not in the invocationSource filter', async ({ lexEvent }) => {
    router.route({ filters: { invocationSource: 'FulfillmentCodeHook' }, handler: vi.fn() });

    const event = lexEvent({ invocationSource: 'DialogCodeHook' });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when botId is in the botId filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { botId: 'MYBOTID' }, handler });

    const event = lexEvent({ bot: { id: 'MYBOTID' } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when botId is in the botId filter array', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { botId: ['MYBOTID', 'OTHERBOTID'] }, handler });

    const event = lexEvent({ bot: { id: 'MYBOTID' } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when botId is not in the botId filter', async ({ lexEvent }) => {
    router.route({ filters: { botId: 'OTHERBOTID' }, handler: vi.fn() });

    const event = lexEvent({ bot: { id: 'TESTBOTID' } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when inputMode is in the inputMode filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { inputMode: 'Speech' }, handler });

    const event = lexEvent({ inputMode: 'Speech' });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when inputMode is in the inputMode filter array', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { inputMode: ['Speech', 'Text'] }, handler });

    const event = lexEvent({ inputMode: 'Speech' });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when inputMode is not in the inputMode filter', async ({ lexEvent }) => {
    router.route({ filters: { inputMode: 'Speech' }, handler: vi.fn() });

    const event = lexEvent({ inputMode: 'Text' });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when a single filter has multiple allowed values', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { intentName: ['OrderPizza', 'OrderDrink'] }, handler });

    const event = lexEvent({ sessionState: { intent: { name: 'OrderDrink' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when all combined filters match', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({
      filters: {
        intentName: 'OrderPizza',
        invocationSource: 'DialogCodeHook',
        botId: 'TESTBOTID',
        inputMode: 'Text',
      },
      handler,
    });

    const event = lexEvent({
      sessionState: { intent: { name: 'OrderPizza' } },
      invocationSource: 'DialogCodeHook',
      bot: { id: 'TESTBOTID' },
      inputMode: 'Text',
    });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when combined filters partially match', async ({ lexEvent }) => {
    router.route({
      filters: { intentName: 'OrderPizza', invocationSource: 'FulfillmentCodeHook' },
      handler: vi.fn(),
    });

    const event = lexEvent({
      sessionState: { intent: { name: 'OrderPizza' } },
      invocationSource: 'DialogCodeHook',
    });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when custom filter returns true', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({ filters: { customFilter: () => true }, handler });

    const event = lexEvent();
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when custom filter returns false', async ({ lexEvent }) => {
    router.route({ filters: { customFilter: () => false }, handler: vi.fn() });

    const event = lexEvent();
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when async custom filter resolves to true', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({
      filters: {
        customFilter: async () => {
          await new Promise((r) => setTimeout(r, 1));
          return true;
        },
      },
      handler,
    });

    const event = lexEvent();
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when async custom filter resolves to false', async ({ lexEvent }) => {
    router.route({
      filters: {
        customFilter: async () => {
          await new Promise((r) => setTimeout(r, 1));
          return false;
        },
      },
      handler: vi.fn(),
    });

    const event = lexEvent();
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('custom filter receives correct input', async ({ lexEvent }) => {
    const customFilter = vi.fn().mockReturnValue(true);
    router.route({ filters: { customFilter }, handler: vi.fn() });

    const event = lexEvent({
      sessionState: { intent: { name: 'OrderPizza' } },
      invocationSource: 'FulfillmentCodeHook',
      inputMode: 'Speech',
      bot: { id: 'MYBOTID' },
    });
    // @ts-expect-error - testing private method
    await router.matchRoute(event);

    expect(customFilter).toHaveBeenCalledWith({
      intentName: 'OrderPizza',
      invocationSource: 'FulfillmentCodeHook',
      inputMode: 'Speech',
      botId: 'MYBOTID',
      event,
    } satisfies LexFilterInput);
  });

  test('custom filter is checked after other filters', async ({ lexEvent }) => {
    const customFilter = vi.fn().mockReturnValue(true);
    router.route({
      filters: { intentName: 'OrderDrink', customFilter },
      handler: vi.fn(),
    });

    const event = lexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });
    // @ts-expect-error - testing private method
    await router.matchRoute(event);

    expect(customFilter).not.toHaveBeenCalled();
  });

  test('matches any event when filters are empty (catch-all)', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.route({ filters: {}, handler });

    const event = lexEvent();
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('first match wins when multiple routes match', async ({ lexEvent }) => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    router.route({ filters: { intentName: 'OrderPizza' }, handler: firstHandler });
    router.route({ filters: { intentName: 'OrderPizza' }, handler: secondHandler });

    const event = lexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result?.handler).toBe(firstHandler);
  });
});

suite('convenience methods', () => {
  test('dialogCodeHook sets the DialogCodeHook invocationSource filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.dialogCodeHook({ filters: {}, handler });

    const event = lexEvent({ invocationSource: 'DialogCodeHook' });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
  });

  test('dialogCodeHook does not match FulfillmentCodeHook events', async ({ lexEvent }) => {
    router.dialogCodeHook({ filters: {}, handler: vi.fn() });

    const event = lexEvent({ invocationSource: 'FulfillmentCodeHook' });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('dialogCodeHook preserves additional filters', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.dialogCodeHook({ filters: { intentName: 'OrderPizza' }, handler });

    const event = lexEvent({
      invocationSource: 'DialogCodeHook',
      sessionState: { intent: { name: 'OrderPizza' } },
    });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('fulfillmentCodeHook sets the FulfillmentCodeHook invocationSource filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.fulfillmentCodeHook({ filters: {}, handler });

    const event = lexEvent({ invocationSource: 'FulfillmentCodeHook' });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
  });

  test('fulfillmentCodeHook does not match DialogCodeHook events', async ({ lexEvent }) => {
    router.fulfillmentCodeHook({ filters: {}, handler: vi.fn() });

    const event = lexEvent({ invocationSource: 'DialogCodeHook' });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('fulfillmentCodeHook preserves additional filters', async ({ lexEvent }) => {
    const handler = vi.fn();
    router.fulfillmentCodeHook({ filters: { intentName: 'OrderPizza', botId: 'TESTBOTID' }, handler });

    const event = lexEvent({
      invocationSource: 'FulfillmentCodeHook',
      sessionState: { intent: { name: 'OrderPizza' } },
      bot: { id: 'TESTBOTID' },
    });
    // @ts-expect-error - testing private method
    const result = await router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });
});

suite('handleEvent', () => {
  test('matched route handler receives correct LexRequest', async ({ lexHandlerEvent }) => {
    const handler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'OrderPizza', state: 'Fulfilled' } },
    });
    router.route({ filters: {}, handler });
    const { event, context } = lexHandlerEvent();

    await router.handleEvent(event, context);

    expect(handler).toHaveBeenCalledWith({
      intentName: event.sessionState.intent.name,
      slots: event.sessionState.intent.slots,
      invocationSource: event.invocationSource,
      sessionAttributes: {},
      inputTranscript: event.inputTranscript,
      bot: event.bot,
      event,
      context,
    });
  });

  test('passes sessionAttributes from the event when present', async ({ lexHandlerEvent }) => {
    const handler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'OrderPizza', state: 'Fulfilled' } },
    });
    router.route({ filters: {}, handler });

    const sessionAttributes = { userId: 'user-123', locale: 'en_US' };
    const { event, context } = lexHandlerEvent({
      event: { sessionState: { sessionAttributes } },
    });

    await router.handleEvent(event, context);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ sessionAttributes }));
  });

  test('returns the handler result', async ({ lexHandlerEvent }) => {
    const expectedResult = {
      sessionState: {
        dialogAction: { type: 'Close' as const },
        intent: { name: 'OrderPizza', state: 'Fulfilled' as const },
      },
    };
    router.route({ filters: {}, handler: vi.fn().mockResolvedValue(expectedResult) });

    const { event, context } = lexHandlerEvent();

    const result = await router.handleEvent(event, context);

    expect(result).toEqual(expectedResult);
  });

  test('throws when no route matches', async ({ lexHandlerEvent }) => {
    router.route({ filters: { intentName: 'OrderDrink' }, handler: vi.fn() });

    const { event, context } = lexHandlerEvent({
      event: {
        sessionState: { intent: { name: 'OrderPizza' } },
        invocationSource: 'DialogCodeHook',
      },
    });

    await expect(router.handleEvent(event, context)).rejects.toThrow(
      'No route matched for Amazon Lex event (intent: OrderPizza, invocationSource: DialogCodeHook)',
    );
  });

  test('handler error propagates', async ({ lexHandlerEvent }) => {
    const handlerError = new Error('handler failed');
    router.route({ filters: {}, handler: vi.fn().mockRejectedValue(handlerError) });

    const { event, context } = lexHandlerEvent();

    await expect(router.handleEvent(event, context)).rejects.toThrow('handler failed');
  });
});

suite('full integration', () => {
  test('dispatches to the correct handler based on invocationSource and intentName', async ({ context }) => {
    const dialogHandler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'Delegate' }, intent: { name: 'OrderPizza', state: 'InProgress' } },
    });
    const fulfillmentHandler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'OrderPizza', state: 'Fulfilled' } },
    });
    const catchAllHandler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'ElicitIntent' } },
    });

    router.dialogCodeHook({
      filters: { intentName: 'OrderPizza' },
      handler: dialogHandler,
    });
    router.fulfillmentCodeHook({
      filters: { intentName: 'OrderPizza' },
      handler: fulfillmentHandler,
    });
    router.route({ filters: {}, handler: catchAllHandler });

    const fulfillmentEvent = createLexEvent({
      invocationSource: 'FulfillmentCodeHook',
      sessionState: { intent: { name: 'OrderPizza' } },
    });
    const mockContext = context();

    const result = await router.handleEvent(fulfillmentEvent, mockContext);

    expect(result).toEqual({
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'OrderPizza', state: 'Fulfilled' } },
    });
    expect(dialogHandler).not.toHaveBeenCalled();
    expect(fulfillmentHandler).toHaveBeenCalledOnce();
    expect(catchAllHandler).not.toHaveBeenCalled();
  });

  test('falls through to catch-all when no specific route matches', async ({ context }) => {
    const specificHandler = vi.fn();
    const catchAllHandler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'ElicitIntent' } },
    });

    router.dialogCodeHook({
      filters: { intentName: 'OrderPizza' },
      handler: specificHandler,
    });
    router.route({ filters: {}, handler: catchAllHandler });

    const event = createLexEvent({
      invocationSource: 'DialogCodeHook',
      sessionState: { intent: { name: 'OrderDrink' } },
    });
    const mockContext = context();

    await router.handleEvent(event, mockContext);

    expect(specificHandler).not.toHaveBeenCalled();
    expect(catchAllHandler).toHaveBeenCalledOnce();
  });

  test('routes chaining works correctly', async ({ lexHandlerEvent }) => {
    const dialogHandler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'Delegate' }, intent: { name: 'OrderPizza', state: 'InProgress' } },
    });
    const fulfillmentHandler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'OrderPizza', state: 'Fulfilled' } },
    });
    router
      .dialogCodeHook({ filters: { intentName: 'OrderPizza' }, handler: dialogHandler })
      .fulfillmentCodeHook({ filters: { intentName: 'OrderPizza' }, handler: fulfillmentHandler })
      .route({ filters: {}, handler: vi.fn() });

    const { event, context } = lexHandlerEvent({
      event: {
        invocationSource: 'DialogCodeHook',
        sessionState: { intent: { name: 'OrderPizza' } },
      },
    });

    await router.handleEvent(event, context);

    expect(dialogHandler).toHaveBeenCalledOnce();
    expect(fulfillmentHandler).not.toHaveBeenCalled();
  });
});

suite('router-level middleware', () => {
  test('executes middleware before the route handler', async ({ lexHandlerEvent }) => {
    const callOrder: string[] = [];

    async function middleware(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('mw-pre');
      const result = await next(request);
      callOrder.push('mw-post');
      return result;
    }

    const router = createLexRouter({ middleware: [middleware] });
    router.route({
      filters: {},
      handler: async () => {
        callOrder.push('handler');
        return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
      },
    });

    const { event, context } = lexHandlerEvent();
    await router.handleEvent(event, context);

    expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
  });

  test('allows middleware to skip a record by not calling next', async ({ lexHandlerEvent }) => {
    const handler = vi.fn();

    async function skipMiddleware(_request: LexRequest, _next: LexNext): Promise<LexV2Result> {
      return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
    }

    const router = createLexRouter({ middleware: [skipMiddleware] });
    router.route({ filters: {}, handler });

    const { event, context } = lexHandlerEvent();
    await router.handleEvent(event, context);

    expect(handler).not.toHaveBeenCalled();
  });

  test('executes multiple router-level middleware in order', async ({ lexHandlerEvent }) => {
    const callOrder: string[] = [];

    async function middlewareOne(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('mw1');
      return next(request);
    }

    async function middlewareTwo(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('mw2');
      return next(request);
    }

    const router = createLexRouter({ middleware: [middlewareOne, middlewareTwo] });
    router.route({
      filters: {},
      handler: async () => {
        callOrder.push('handler');
        return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
      },
    });

    const { event, context } = lexHandlerEvent();
    await router.handleEvent(event, context);

    expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
  });
});

suite('route-level middleware', () => {
  test('executes route-level middleware for a specific route', async ({ lexHandlerEvent }) => {
    const callOrder: string[] = [];

    async function routeMiddleware(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('route-mw');
      return next(request);
    }

    router.route({
      filters: {},
      middleware: [routeMiddleware],
      handler: async () => {
        callOrder.push('handler');
        return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
      },
    });

    const { event, context } = lexHandlerEvent();
    await router.handleEvent(event, context);

    expect(callOrder).toEqual(['route-mw', 'handler']);
  });

  test('allows route-level middleware to short-circuit by not calling next', async ({ lexHandlerEvent }) => {
    const handler = vi.fn();
    const mockResult: LexV2Result = {
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } },
    };

    async function blockingRouteMiddleware(_request: LexRequest, _next: LexNext): Promise<LexV2Result> {
      return mockResult;
    }

    router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

    const { event, context } = lexHandlerEvent();
    await router.handleEvent(event, context);

    expect(handler).not.toHaveBeenCalled();
  });

  test('executes multiple route-level middleware in order', async ({ lexHandlerEvent }) => {
    const callOrder: string[] = [];

    async function routeMiddlewareOne(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('route-mw1');
      return next(request);
    }

    async function routeMiddlewareTwo(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('route-mw2');
      return next(request);
    }

    router.route({
      filters: {},
      middleware: [routeMiddlewareOne, routeMiddlewareTwo],
      handler: async () => {
        callOrder.push('handler');
        return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
      },
    });

    const { event, context } = lexHandlerEvent();
    await router.handleEvent(event, context);

    expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
  });

  test('supports middleware on defineRoute builder pattern', async ({ lexHandlerEvent }) => {
    const callOrder: string[] = [];

    async function routeMiddleware(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('route-mw');
      return next(request);
    }

    const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
      callOrder.push('handler');
      return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
    });

    router.route(route);

    const { event, context } = lexHandlerEvent();
    await router.handleEvent(event, context);

    expect(callOrder).toEqual(['route-mw', 'handler']);
  });
});

suite('combined router and route middleware', () => {
  test('executes router middleware before route middleware', async ({ lexHandlerEvent }) => {
    const callOrder: string[] = [];

    async function routerMiddleware(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('router-mw');
      return next(request);
    }

    async function routeMiddleware(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('route-mw');
      return next(request);
    }

    const router = createLexRouter({ middleware: [routerMiddleware] });
    router.route({
      filters: {},
      middleware: [routeMiddleware],
      handler: async () => {
        callOrder.push('handler');
        return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
      },
    });

    const { event, context } = lexHandlerEvent();
    await router.handleEvent(event, context);

    expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
  });

  test('router middleware short-circuit prevents route middleware from running', async ({ lexHandlerEvent }) => {
    const routeMiddleware = vi.fn();
    const handler = vi.fn();
    const mockResult: LexV2Result = {
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } },
    };

    async function blockingRouterMiddleware(_request: LexRequest, _next: LexNext): Promise<LexV2Result> {
      return mockResult;
    }

    const router = createLexRouter({ middleware: [blockingRouterMiddleware] });
    router.route({ filters: {}, middleware: [routeMiddleware], handler });

    const { event, context } = lexHandlerEvent();
    await router.handleEvent(event, context);

    expect(routeMiddleware).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});
