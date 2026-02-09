import { createLexEvent, test } from '@lambda-event-router/testing';
import { createLexRouter, defineRoute, LexRouter } from './LexRouter.js';
import type { LexFilterInput } from './types.js';

suite('createLexRouter', () => {
  test('returns an LexRouter instance', () => {
    const router = createLexRouter();

    expect(router).toBeInstanceOf(LexRouter);
  });
});

suite('canHandleEvent', () => {
  const router = createLexRouter();

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

    const definition = defineRoute({ filters: { intentNames: ['OrderPizza'] } }).handle(handler);

    expect(definition).toEqual({
      filters: { intentNames: ['OrderPizza'] },
      handler,
    });
  });

  test('preserves all filter configuration', () => {
    const handler = vi.fn();
    const customFilter = vi.fn();

    const definition = defineRoute({
      filters: {
        intentNames: ['OrderPizza'],
        invocationSources: ['DialogCodeHook'],
        botIds: ['TESTBOTID'],
        inputModes: ['Text'],
        customFilter,
      },
    }).handle(handler);

    expect(definition.filters).toEqual({
      intentNames: ['OrderPizza'],
      invocationSources: ['DialogCodeHook'],
      botIds: ['TESTBOTID'],
      inputModes: ['Text'],
      customFilter,
    });
  });
});

suite('route', () => {
  test('route, dialogCodeHook and fulfillmentCodeHook return this for chaining', () => {
    const router = createLexRouter();
    const handler = vi.fn();

    const routeResult = router.route({ filters: { intentNames: ['OrderPizza'] }, handler });
    const dialogResult = router.dialogCodeHook({ filters: {}, handler });
    const fulfillmentResult = router.fulfillmentCodeHook({ filters: {}, handler });

    expect(routeResult).toBe(router);
    expect(dialogResult).toBe(router);
    expect(fulfillmentResult).toBe(router);
  });
});

suite('matchRoute', () => {
  test('matches when intentName is in the intentNames filter', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.route({ filters: { intentNames: ['CheckBalance'] }, handler });
    const event = lexEvent({ sessionState: { intent: { name: 'CheckBalance' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when intentName is not in the intentNames filter', ({ lexEvent }) => {
    const router = createLexRouter();
    router.route({ filters: { intentNames: ['OrderDrink'] }, handler: vi.fn() });
    const event = lexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when invocationSource is in the invocationSources filter', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.route({ filters: { invocationSources: ['FulfillmentCodeHook'] }, handler });
    const event = lexEvent({ invocationSource: 'FulfillmentCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when invocationSource is not in the invocationSources filter', ({ lexEvent }) => {
    const router = createLexRouter();
    router.route({ filters: { invocationSources: ['FulfillmentCodeHook'] }, handler: vi.fn() });
    const event = lexEvent({ invocationSource: 'DialogCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when botId is in the botIds filter', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.route({ filters: { botIds: ['MYBOTID'] }, handler });
    const event = lexEvent({ bot: { id: 'MYBOTID' } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when botId is not in the botIds filter', ({ lexEvent }) => {
    const router = createLexRouter();
    router.route({ filters: { botIds: ['OTHERBOTID'] }, handler: vi.fn() });
    const event = lexEvent({ bot: { id: 'TESTBOTID' } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when inputMode is in the inputModes filter', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.route({ filters: { inputModes: ['Speech'] }, handler });
    const event = lexEvent({ inputMode: 'Speech' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when inputMode is not in the inputModes filter', ({ lexEvent }) => {
    const router = createLexRouter();
    router.route({ filters: { inputModes: ['Speech'] }, handler: vi.fn() });
    const event = lexEvent({ inputMode: 'Text' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when a single filter has multiple allowed values', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.route({ filters: { intentNames: ['OrderPizza', 'OrderDrink'] }, handler });
    const event = lexEvent({ sessionState: { intent: { name: 'OrderDrink' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when all combined filters match', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.route({
      filters: {
        intentNames: ['OrderPizza'],
        invocationSources: ['DialogCodeHook'],
        botIds: ['TESTBOTID'],
        inputModes: ['Text'],
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
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when combined filters partially match', ({ lexEvent }) => {
    const router = createLexRouter();
    router.route({
      filters: { intentNames: ['OrderPizza'], invocationSources: ['FulfillmentCodeHook'] },
      handler: vi.fn(),
    });
    const event = lexEvent({
      sessionState: { intent: { name: 'OrderPizza' } },
      invocationSource: 'DialogCodeHook',
    });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when custom filter returns true', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.route({ filters: { customFilter: () => true }, handler });
    const event = lexEvent();

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when custom filter returns false', ({ lexEvent }) => {
    const router = createLexRouter();
    router.route({ filters: { customFilter: () => false }, handler: vi.fn() });
    const event = lexEvent();

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('custom filter receives correct input', ({ lexEvent }) => {
    const router = createLexRouter();
    const customFilter = vi.fn().mockReturnValue(true);
    router.route({ filters: { customFilter }, handler: vi.fn() });
    const event = lexEvent({
      sessionState: { intent: { name: 'OrderPizza' } },
      invocationSource: 'FulfillmentCodeHook',
      inputMode: 'Speech',
      bot: { id: 'MYBOTID' },
    });

    // @ts-expect-error - testing private method
    router.matchRoute(event);

    expect(customFilter).toHaveBeenCalledWith({
      intentName: 'OrderPizza',
      invocationSource: 'FulfillmentCodeHook',
      inputMode: 'Speech',
      botId: 'MYBOTID',
      event,
    } satisfies LexFilterInput);
  });

  test('custom filter is checked after other filters', ({ lexEvent }) => {
    const router = createLexRouter();
    const customFilter = vi.fn().mockReturnValue(true);
    router.route({
      filters: { intentNames: ['OrderDrink'], customFilter },
      handler: vi.fn(),
    });
    const event = lexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });

    // @ts-expect-error - testing private method
    router.matchRoute(event);

    expect(customFilter).not.toHaveBeenCalled();
  });

  test('matches any event when filters are empty (catch-all)', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.route({ filters: {}, handler });
    const event = lexEvent();

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('first match wins when multiple routes match', ({ lexEvent }) => {
    const router = createLexRouter();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    router.route({ filters: { intentNames: ['OrderPizza'] }, handler: firstHandler });
    router.route({ filters: { intentNames: ['OrderPizza'] }, handler: secondHandler });
    const event = lexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result?.handler).toBe(firstHandler);
  });
});

suite('convenience methods', () => {
  test('dialogCodeHook sets the DialogCodeHook invocationSource filter', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.dialogCodeHook({ filters: {}, handler });
    const event = lexEvent({ invocationSource: 'DialogCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
  });

  test('dialogCodeHook does not match FulfillmentCodeHook events', ({ lexEvent }) => {
    const router = createLexRouter();
    router.dialogCodeHook({ filters: {}, handler: vi.fn() });
    const event = lexEvent({ invocationSource: 'FulfillmentCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('dialogCodeHook preserves additional filters', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.dialogCodeHook({ filters: { intentNames: ['OrderPizza'] }, handler });
    const event = lexEvent({
      invocationSource: 'DialogCodeHook',
      sessionState: { intent: { name: 'OrderPizza' } },
    });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('fulfillmentCodeHook sets the FulfillmentCodeHook invocationSource filter', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.fulfillmentCodeHook({ filters: {}, handler });
    const event = lexEvent({ invocationSource: 'FulfillmentCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
  });

  test('fulfillmentCodeHook does not match DialogCodeHook events', ({ lexEvent }) => {
    const router = createLexRouter();
    router.fulfillmentCodeHook({ filters: {}, handler: vi.fn() });
    const event = lexEvent({ invocationSource: 'DialogCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('fulfillmentCodeHook preserves additional filters', ({ lexEvent }) => {
    const router = createLexRouter();
    const handler = vi.fn();
    router.fulfillmentCodeHook({ filters: { intentNames: ['OrderPizza'], botIds: ['TESTBOTID'] }, handler });
    const event = lexEvent({
      invocationSource: 'FulfillmentCodeHook',
      sessionState: { intent: { name: 'OrderPizza' } },
      bot: { id: 'TESTBOTID' },
    });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });
});

suite('handleEvent', () => {
  test('matched route handler receives correct LexRequest', async ({ lexHandlerEvent }) => {
    const router = createLexRouter();
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
    const router = createLexRouter();
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
    const router = createLexRouter();
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
    const router = createLexRouter();
    router.route({ filters: { intentNames: ['OrderDrink'] }, handler: vi.fn() });
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
    const router = createLexRouter();
    const handlerError = new Error('handler failed');
    router.route({ filters: {}, handler: vi.fn().mockRejectedValue(handlerError) });
    const { event, context } = lexHandlerEvent();

    await expect(router.handleEvent(event, context)).rejects.toThrow('handler failed');
  });
});

suite('full integration', () => {
  test('dispatches to the correct handler based on invocationSource and intentName', async ({ context }) => {
    const router = createLexRouter();
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
      filters: { intentNames: ['OrderPizza'] },
      handler: dialogHandler,
    });
    router.fulfillmentCodeHook({
      filters: { intentNames: ['OrderPizza'] },
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
    const router = createLexRouter();
    const specificHandler = vi.fn();
    const catchAllHandler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'ElicitIntent' } },
    });

    router.dialogCodeHook({
      filters: { intentNames: ['OrderPizza'] },
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

    const router = createLexRouter()
      .dialogCodeHook({ filters: { intentNames: ['OrderPizza'] }, handler: dialogHandler })
      .fulfillmentCodeHook({ filters: { intentNames: ['OrderPizza'] }, handler: fulfillmentHandler })
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
