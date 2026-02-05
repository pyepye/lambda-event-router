import { createAmazonLexEvent, test } from '@lambda-event-router/testing';
import { AmazonLexRouter, createAmazonLexRouter, defineRoute } from './AmazonLex.js';
import type { AmazonLexFilterInput } from './types.js';

suite('createAmazonLexRouter', () => {
  test('returns an AmazonLexRouter instance', () => {
    const router = createAmazonLexRouter();

    expect(router).toBeInstanceOf(AmazonLexRouter);
  });
});

suite('canHandleEvent', () => {
  const router = createAmazonLexRouter();

  test('returns true for a valid LexV2Event', ({ amazonLexEvent }) => {
    const event = amazonLexEvent();

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
    const router = createAmazonLexRouter();
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
  test('matches when intentName is in the intentNames filter', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn();
    router.route({ filters: { intentNames: ['CheckBalance'] }, handler });
    const event = amazonLexEvent({ sessionState: { intent: { name: 'CheckBalance' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when intentName is not in the intentNames filter', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    router.route({ filters: { intentNames: ['OrderDrink'] }, handler: vi.fn() });
    const event = amazonLexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when invocationSource is in the invocationSources filter', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn();
    router.route({ filters: { invocationSources: ['FulfillmentCodeHook'] }, handler });
    const event = amazonLexEvent({ invocationSource: 'FulfillmentCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when invocationSource is not in the invocationSources filter', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    router.route({ filters: { invocationSources: ['FulfillmentCodeHook'] }, handler: vi.fn() });
    const event = amazonLexEvent({ invocationSource: 'DialogCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when botId is in the botIds filter', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn();
    router.route({ filters: { botIds: ['MYBOTID'] }, handler });
    const event = amazonLexEvent({ bot: { id: 'MYBOTID' } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when botId is not in the botIds filter', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    router.route({ filters: { botIds: ['OTHERBOTID'] }, handler: vi.fn() });
    const event = amazonLexEvent({ bot: { id: 'TESTBOTID' } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when inputMode is in the inputModes filter', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn();
    router.route({ filters: { inputModes: ['Speech'] }, handler });
    const event = amazonLexEvent({ inputMode: 'Speech' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when inputMode is not in the inputModes filter', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    router.route({ filters: { inputModes: ['Speech'] }, handler: vi.fn() });
    const event = amazonLexEvent({ inputMode: 'Text' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when a single filter has multiple allowed values', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn();
    router.route({ filters: { intentNames: ['OrderPizza', 'OrderDrink'] }, handler });
    const event = amazonLexEvent({ sessionState: { intent: { name: 'OrderDrink' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when all combined filters match', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
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
    const event = amazonLexEvent({
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

  test('does not match when combined filters partially match', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    router.route({
      filters: { intentNames: ['OrderPizza'], invocationSources: ['FulfillmentCodeHook'] },
      handler: vi.fn(),
    });
    const event = amazonLexEvent({
      sessionState: { intent: { name: 'OrderPizza' } },
      invocationSource: 'DialogCodeHook',
    });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when custom filter returns true', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn();
    router.route({ filters: { customFilter: () => true }, handler });
    const event = amazonLexEvent();

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when custom filter returns false', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    router.route({ filters: { customFilter: () => false }, handler: vi.fn() });
    const event = amazonLexEvent();

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('custom filter receives correct input', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const customFilter = vi.fn().mockReturnValue(true);
    router.route({ filters: { customFilter }, handler: vi.fn() });
    const event = amazonLexEvent({
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
    } satisfies AmazonLexFilterInput);
  });

  test('custom filter is checked after other filters', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const customFilter = vi.fn().mockReturnValue(true);
    router.route({
      filters: { intentNames: ['OrderDrink'], customFilter },
      handler: vi.fn(),
    });
    const event = amazonLexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });

    // @ts-expect-error - testing private method
    router.matchRoute(event);

    expect(customFilter).not.toHaveBeenCalled();
  });

  test('matches any event when filters are empty (catch-all)', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn();
    router.route({ filters: {}, handler });
    const event = amazonLexEvent();

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('first match wins when multiple routes match', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    router.route({ filters: { intentNames: ['OrderPizza'] }, handler: firstHandler });
    router.route({ filters: { intentNames: ['OrderPizza'] }, handler: secondHandler });
    const event = amazonLexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result?.handler).toBe(firstHandler);
  });
});

suite('convenience methods', () => {
  test('dialogCodeHook sets the DialogCodeHook invocationSource filter', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn();
    router.dialogCodeHook({ filters: {}, handler });
    const event = amazonLexEvent({ invocationSource: 'DialogCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
  });

  test('dialogCodeHook does not match FulfillmentCodeHook events', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    router.dialogCodeHook({ filters: {}, handler: vi.fn() });
    const event = amazonLexEvent({ invocationSource: 'FulfillmentCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('dialogCodeHook preserves additional filters', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn();
    router.dialogCodeHook({ filters: { intentNames: ['OrderPizza'] }, handler });
    const event = amazonLexEvent({
      invocationSource: 'DialogCodeHook',
      sessionState: { intent: { name: 'OrderPizza' } },
    });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('fulfillmentCodeHook sets the FulfillmentCodeHook invocationSource filter', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn();
    router.fulfillmentCodeHook({ filters: {}, handler });
    const event = amazonLexEvent({ invocationSource: 'FulfillmentCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
  });

  test('fulfillmentCodeHook does not match DialogCodeHook events', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    router.fulfillmentCodeHook({ filters: {}, handler: vi.fn() });
    const event = amazonLexEvent({ invocationSource: 'DialogCodeHook' });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('fulfillmentCodeHook preserves additional filters', ({ amazonLexEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn();
    router.fulfillmentCodeHook({ filters: { intentNames: ['OrderPizza'], botIds: ['TESTBOTID'] }, handler });
    const event = amazonLexEvent({
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
  test('matched route handler receives correct AmazonLexRequest', async ({ amazonLexHandlerEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'OrderPizza', state: 'Fulfilled' } },
    });
    router.route({ filters: {}, handler });
    const { event, context } = amazonLexHandlerEvent();

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

  test('passes sessionAttributes from the event when present', async ({ amazonLexHandlerEvent }) => {
    const router = createAmazonLexRouter();
    const handler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'OrderPizza', state: 'Fulfilled' } },
    });
    router.route({ filters: {}, handler });
    const sessionAttributes = { userId: 'user-123', locale: 'en_US' };
    const { event, context } = amazonLexHandlerEvent({
      event: { sessionState: { sessionAttributes } },
    });

    await router.handleEvent(event, context);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ sessionAttributes }));
  });

  test('returns the handler result', async ({ amazonLexHandlerEvent }) => {
    const router = createAmazonLexRouter();
    const expectedResult = {
      sessionState: {
        dialogAction: { type: 'Close' as const },
        intent: { name: 'OrderPizza', state: 'Fulfilled' as const },
      },
    };
    router.route({ filters: {}, handler: vi.fn().mockResolvedValue(expectedResult) });
    const { event, context } = amazonLexHandlerEvent();

    const result = await router.handleEvent(event, context);

    expect(result).toEqual(expectedResult);
  });

  test('throws when no route matches', async ({ amazonLexHandlerEvent }) => {
    const router = createAmazonLexRouter();
    router.route({ filters: { intentNames: ['OrderDrink'] }, handler: vi.fn() });
    const { event, context } = amazonLexHandlerEvent({
      event: {
        sessionState: { intent: { name: 'OrderPizza' } },
        invocationSource: 'DialogCodeHook',
      },
    });

    await expect(router.handleEvent(event, context)).rejects.toThrow(
      'No route matched for Amazon Lex event (intent: OrderPizza, invocationSource: DialogCodeHook)',
    );
  });

  test('handler error propagates', async ({ amazonLexHandlerEvent }) => {
    const router = createAmazonLexRouter();
    const handlerError = new Error('handler failed');
    router.route({ filters: {}, handler: vi.fn().mockRejectedValue(handlerError) });
    const { event, context } = amazonLexHandlerEvent();

    await expect(router.handleEvent(event, context)).rejects.toThrow('handler failed');
  });
});

suite('full integration', () => {
  test('dispatches to the correct handler based on invocationSource and intentName', async ({ context }) => {
    const router = createAmazonLexRouter();
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

    const fulfillmentEvent = createAmazonLexEvent({
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
    const router = createAmazonLexRouter();
    const specificHandler = vi.fn();
    const catchAllHandler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'ElicitIntent' } },
    });

    router.dialogCodeHook({
      filters: { intentNames: ['OrderPizza'] },
      handler: specificHandler,
    });
    router.route({ filters: {}, handler: catchAllHandler });

    const event = createAmazonLexEvent({
      invocationSource: 'DialogCodeHook',
      sessionState: { intent: { name: 'OrderDrink' } },
    });
    const mockContext = context();

    await router.handleEvent(event, mockContext);

    expect(specificHandler).not.toHaveBeenCalled();
    expect(catchAllHandler).toHaveBeenCalledOnce();
  });

  test('routes chaining works correctly', async ({ amazonLexHandlerEvent }) => {
    const dialogHandler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'Delegate' }, intent: { name: 'OrderPizza', state: 'InProgress' } },
    });
    const fulfillmentHandler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'OrderPizza', state: 'Fulfilled' } },
    });

    const router = createAmazonLexRouter()
      .dialogCodeHook({ filters: { intentNames: ['OrderPizza'] }, handler: dialogHandler })
      .fulfillmentCodeHook({ filters: { intentNames: ['OrderPizza'] }, handler: fulfillmentHandler })
      .route({ filters: {}, handler: vi.fn() });

    const { event, context } = amazonLexHandlerEvent({
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
