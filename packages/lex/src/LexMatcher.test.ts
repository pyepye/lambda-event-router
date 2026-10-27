import type { LexV2Result } from 'aws-lambda';

import { allEventBuilders, createLexEvent, test } from '@latcher/testing';

import { createLexMatcher, defineRoute, LexMatcher } from './LexMatcher.js';
import type { LexFilterInput, LexRequest } from './types.js';

type LexNext = (request: LexRequest) => Promise<LexV2Result>;

let matcher: LexMatcher;

beforeEach(() => {
  matcher = new LexMatcher();
});

suite('createLexMatcher', () => {
  test('returns an LexMatcher instance', () => {
    const matcher = createLexMatcher();

    expect(matcher).toBeInstanceOf(LexMatcher);
  });
});

suite('canHandleEvent', () => {
  test('returns true for a valid LexV2Event', ({ lexEvent }) => {
    const event = lexEvent();

    const result = matcher.canHandleEvent(event);

    expect(result).toBe(true);
  });

  test('returns false for non-object events', () => {
    expect(matcher.canHandleEvent(null)).toBe(false);
    expect(matcher.canHandleEvent('string')).toBe(false);
    expect(matcher.canHandleEvent(42)).toBe(false);
  });

  test('returns false when sessionState is missing', () => {
    const event = { bot: { id: 'abc' }, interpretations: [], invocationSource: 'DialogCodeHook' };

    const result = matcher.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false when bot is missing', () => {
    const event = {
      sessionState: { intent: { name: 'test' } },
      interpretations: [],
      invocationSource: 'DialogCodeHook',
    };

    const result = matcher.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false when bot.id is not a string', () => {
    const event = {
      sessionState: { intent: { name: 'test' } },
      bot: { id: 123 },
      interpretations: [],
      invocationSource: 'DialogCodeHook',
    };

    const result = matcher.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false when interpretations is not an array', () => {
    const event = {
      sessionState: { intent: { name: 'test' } },
      bot: { id: 'abc' },
      interpretations: 'not-an-array',
      invocationSource: 'DialogCodeHook',
    };

    const result = matcher.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false when invocationSource is missing', () => {
    const event = {
      sessionState: { intent: { name: 'test' } },
      bot: { id: 'abc' },
      interpretations: [],
    };

    const result = matcher.canHandleEvent(event);

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
    const custom = vi.fn();
    const definition = defineRoute({
      filters: {
        intentName: 'OrderPizza',
        invocationSource: 'DialogCodeHook',
        botId: 'TESTBOTID',
        inputMode: 'Text',
        custom,
      },
    }).handle(handler);

    expect(definition.filters).toEqual({
      intentName: 'OrderPizza',
      invocationSource: 'DialogCodeHook',
      botId: 'TESTBOTID',
      inputMode: 'Text',
      custom,
    });
  });
});

suite('route', () => {
  test('route, dialogCodeHook and fulfillmentCodeHook return this for chaining', () => {
    const handler = vi.fn();

    const routeResult = matcher.route({ filters: { intentName: 'OrderPizza' }, handler });
    const dialogResult = matcher.dialogCodeHook({ filters: {}, handler });
    const fulfillmentResult = matcher.fulfillmentCodeHook({ filters: {}, handler });

    expect(routeResult).toBe(matcher);
    expect(dialogResult).toBe(matcher);
    expect(fulfillmentResult).toBe(matcher);
  });
});

suite('matchRoute', () => {
  test('matches when intentName is in the intentName filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { intentName: 'CheckBalance' }, handler });

    const event = lexEvent({ sessionState: { intent: { name: 'CheckBalance' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('orders a narrower route ahead of a broader one registered first', async ({ lexEvent }) => {
    const broad = vi.fn();
    const narrow = vi.fn();
    matcher.route({ filters: {}, handler: broad });
    matcher.route({ filters: { intentName: 'CheckBalance' }, handler: narrow });

    const event = lexEvent({ sessionState: { intent: { name: 'CheckBalance' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result?.handler).toBe(narrow);
  });

  test('orders a guarded route ahead of the fallback it shares filters with', async ({ lexEvent }) => {
    const fallback = vi.fn();
    const guarded = vi.fn();
    matcher.route({ filters: { intentName: 'CheckBalance' }, handler: fallback });
    matcher.route({ filters: { intentName: 'CheckBalance', custom: () => true }, handler: guarded });

    const event = lexEvent({ sessionState: { intent: { name: 'CheckBalance' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result?.handler).toBe(guarded);
  });

  test('does not match when intentName is an empty string', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { intentName: '' }, handler });

    const event = lexEvent({ sessionState: { intent: { name: 'CheckBalance' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when intentName is in the intentName filter array', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { intentName: ['CheckBalance', 'UpdateBalance'] }, handler });

    const event = lexEvent({ sessionState: { intent: { name: 'CheckBalance' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when intentName is not in the intentName filter', async ({ lexEvent }) => {
    matcher.route({ filters: { intentName: 'OrderDrink' }, handler: vi.fn() });

    const event = lexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when invocationSource is in the invocationSource filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { invocationSource: 'FulfillmentCodeHook' }, handler });

    const event = lexEvent({ invocationSource: 'FulfillmentCodeHook' });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when invocationSource is in the invocationSource filter array', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { invocationSource: ['FulfillmentCodeHook', 'DialogCodeHook'] }, handler });

    const event = lexEvent({ invocationSource: 'FulfillmentCodeHook' });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when invocationSource is not in the invocationSource filter', async ({ lexEvent }) => {
    matcher.route({ filters: { invocationSource: 'FulfillmentCodeHook' }, handler: vi.fn() });

    const event = lexEvent({ invocationSource: 'DialogCodeHook' });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when botId is in the botId filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { botId: 'MYBOTID' }, handler });

    const event = lexEvent({ bot: { id: 'MYBOTID' } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when botId is in the botId filter array', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { botId: ['MYBOTID', 'OTHERBOTID'] }, handler });

    const event = lexEvent({ bot: { id: 'MYBOTID' } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when botId is not in the botId filter', async ({ lexEvent }) => {
    matcher.route({ filters: { botId: 'OTHERBOTID' }, handler: vi.fn() });

    const event = lexEvent({ bot: { id: 'TESTBOTID' } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when inputMode is in the inputMode filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { inputMode: 'Speech' }, handler });

    const event = lexEvent({ inputMode: 'Speech' });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when inputMode is in the inputMode filter array', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { inputMode: ['Speech', 'Text'] }, handler });

    const event = lexEvent({ inputMode: 'Speech' });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when inputMode is not in the inputMode filter', async ({ lexEvent }) => {
    matcher.route({ filters: { inputMode: 'Speech' }, handler: vi.fn() });

    const event = lexEvent({ inputMode: 'Text' });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when a single filter has multiple allowed values', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { intentName: ['OrderPizza', 'OrderDrink'] }, handler });

    const event = lexEvent({ sessionState: { intent: { name: 'OrderDrink' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when all combined filters match', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({
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
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when combined filters partially match', async ({ lexEvent }) => {
    matcher.route({
      filters: { intentName: 'OrderPizza', invocationSource: 'FulfillmentCodeHook' },
      handler: vi.fn(),
    });

    const event = lexEvent({
      sessionState: { intent: { name: 'OrderPizza' } },
      invocationSource: 'DialogCodeHook',
    });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when custom filter returns true', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: { custom: () => true }, handler });

    const event = lexEvent();
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when custom filter returns false', async ({ lexEvent }) => {
    matcher.route({ filters: { custom: () => false }, handler: vi.fn() });

    const event = lexEvent();
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when async custom filter resolves to true', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({
      filters: {
        custom: async () => {
          await new Promise((r) => setTimeout(r, 1));
          return true;
        },
      },
      handler,
    });

    const event = lexEvent();
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when async custom filter resolves to false', async ({ lexEvent }) => {
    matcher.route({
      filters: {
        custom: async () => {
          await new Promise((r) => setTimeout(r, 1));
          return false;
        },
      },
      handler: vi.fn(),
    });

    const event = lexEvent();
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('custom filter receives correct input', async ({ lexEvent }) => {
    const custom = vi.fn().mockReturnValue(true);
    matcher.route({ filters: { custom }, handler: vi.fn() });

    const event = lexEvent({
      sessionState: { intent: { name: 'OrderPizza' } },
      invocationSource: 'FulfillmentCodeHook',
      inputMode: 'Speech',
      bot: { id: 'MYBOTID' },
    });
    // @ts-expect-error - testing private method
    await matcher.matchRoute(event);

    expect(custom).toHaveBeenCalledWith({
      intentName: 'OrderPizza',
      invocationSource: 'FulfillmentCodeHook',
      inputMode: 'Speech',
      botId: 'MYBOTID',
      event,
    } satisfies LexFilterInput);
  });

  test('custom filter is checked after other filters', async ({ lexEvent }) => {
    const custom = vi.fn().mockReturnValue(true);
    matcher.route({
      filters: { intentName: 'OrderDrink', custom },
      handler: vi.fn(),
    });

    const event = lexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });
    // @ts-expect-error - testing private method
    await matcher.matchRoute(event);

    expect(custom).not.toHaveBeenCalled();
  });

  test('matches any event when filters are empty (catch-all)', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.route({ filters: {}, handler });

    const event = lexEvent();
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('first match wins when multiple routes match', async ({ lexEvent }) => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    matcher.route({ filters: { intentName: 'OrderPizza' }, handler: firstHandler });
    matcher.route({ filters: { intentName: 'OrderPizza' }, handler: secondHandler });

    const event = lexEvent({ sessionState: { intent: { name: 'OrderPizza' } } });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result?.handler).toBe(firstHandler);
  });
});

suite('convenience methods', () => {
  test('dialogCodeHook sets the DialogCodeHook invocationSource filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.dialogCodeHook({ filters: {}, handler });

    const event = lexEvent({ invocationSource: 'DialogCodeHook' });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
  });

  test('dialogCodeHook does not match FulfillmentCodeHook events', async ({ lexEvent }) => {
    matcher.dialogCodeHook({ filters: {}, handler: vi.fn() });

    const event = lexEvent({ invocationSource: 'FulfillmentCodeHook' });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('dialogCodeHook preserves additional filters', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.dialogCodeHook({ filters: { intentName: 'OrderPizza' }, handler });

    const event = lexEvent({
      invocationSource: 'DialogCodeHook',
      sessionState: { intent: { name: 'OrderPizza' } },
    });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('fulfillmentCodeHook sets the FulfillmentCodeHook invocationSource filter', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.fulfillmentCodeHook({ filters: {}, handler });

    const event = lexEvent({ invocationSource: 'FulfillmentCodeHook' });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
  });

  test('fulfillmentCodeHook does not match DialogCodeHook events', async ({ lexEvent }) => {
    matcher.fulfillmentCodeHook({ filters: {}, handler: vi.fn() });

    const event = lexEvent({ invocationSource: 'DialogCodeHook' });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('fulfillmentCodeHook preserves additional filters', async ({ lexEvent }) => {
    const handler = vi.fn();
    matcher.fulfillmentCodeHook({ filters: { intentName: 'OrderPizza', botId: 'TESTBOTID' }, handler });

    const event = lexEvent({
      invocationSource: 'FulfillmentCodeHook',
      sessionState: { intent: { name: 'OrderPizza' } },
      bot: { id: 'TESTBOTID' },
    });
    // @ts-expect-error - testing private method
    const result = await matcher.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });
});

suite('handleEvent', () => {
  test('matched route handler receives correct LexRequest', async ({ lexHandlerEvent }) => {
    const handler = vi.fn().mockResolvedValue({
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'OrderPizza', state: 'Fulfilled' } },
    });
    matcher.route({ filters: {}, handler });
    const { event, context } = lexHandlerEvent();

    await matcher.handleEvent(event, context);

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
    matcher.route({ filters: {}, handler });

    const sessionAttributes = { userId: 'user-123', locale: 'en_US' };
    const { event, context } = lexHandlerEvent({
      event: { sessionState: { sessionAttributes } },
    });

    await matcher.handleEvent(event, context);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ sessionAttributes }));
  });

  test('returns the handler result', async ({ lexHandlerEvent }) => {
    const expectedResult = {
      sessionState: {
        dialogAction: { type: 'Close' as const },
        intent: { name: 'OrderPizza', state: 'Fulfilled' as const },
      },
    };
    matcher.route({ filters: {}, handler: vi.fn().mockResolvedValue(expectedResult) });

    const { event, context } = lexHandlerEvent();

    const result = await matcher.handleEvent(event, context);

    expect(result).toEqual(expectedResult);
  });

  test('throws when no route matches', async ({ lexHandlerEvent }) => {
    matcher.route({ filters: { intentName: 'OrderDrink' }, handler: vi.fn() });

    const { event, context } = lexHandlerEvent({
      event: {
        sessionState: { intent: { name: 'OrderPizza' } },
        invocationSource: 'DialogCodeHook',
      },
    });

    await expect(matcher.handleEvent(event, context)).rejects.toThrow(
      'No route matched for Amazon Lex event (intent: OrderPizza, invocationSource: DialogCodeHook)',
    );
  });

  test('handler error propagates', async ({ lexHandlerEvent }) => {
    const handlerError = new Error('handler failed');
    matcher.route({ filters: {}, handler: vi.fn().mockRejectedValue(handlerError) });

    const { event, context } = lexHandlerEvent();

    await expect(matcher.handleEvent(event, context)).rejects.toThrow('handler failed');
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

    matcher.dialogCodeHook({
      filters: { intentName: 'OrderPizza' },
      handler: dialogHandler,
    });
    matcher.fulfillmentCodeHook({
      filters: { intentName: 'OrderPizza' },
      handler: fulfillmentHandler,
    });
    matcher.route({ filters: {}, handler: catchAllHandler });

    const fulfillmentEvent = createLexEvent({
      invocationSource: 'FulfillmentCodeHook',
      sessionState: { intent: { name: 'OrderPizza' } },
    });
    const mockContext = context();

    const result = await matcher.handleEvent(fulfillmentEvent, mockContext);

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

    matcher.dialogCodeHook({
      filters: { intentName: 'OrderPizza' },
      handler: specificHandler,
    });
    matcher.route({ filters: {}, handler: catchAllHandler });

    const event = createLexEvent({
      invocationSource: 'DialogCodeHook',
      sessionState: { intent: { name: 'OrderDrink' } },
    });
    const mockContext = context();

    await matcher.handleEvent(event, mockContext);

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
    matcher
      .dialogCodeHook({ filters: { intentName: 'OrderPizza' }, handler: dialogHandler })
      .fulfillmentCodeHook({ filters: { intentName: 'OrderPizza' }, handler: fulfillmentHandler })
      .route({ filters: {}, handler: vi.fn() });

    const { event, context } = lexHandlerEvent({
      event: {
        invocationSource: 'DialogCodeHook',
        sessionState: { intent: { name: 'OrderPizza' } },
      },
    });

    await matcher.handleEvent(event, context);

    expect(dialogHandler).toHaveBeenCalledOnce();
    expect(fulfillmentHandler).not.toHaveBeenCalled();
  });
});

suite('matcher-level middleware', () => {
  test('executes middleware before the route handler', async ({ lexHandlerEvent }) => {
    const callOrder: string[] = [];

    async function middleware(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('mw-pre');
      const result = await next(request);
      callOrder.push('mw-post');
      return result;
    }

    const matcher = createLexMatcher({ middleware: [middleware] });
    matcher.route({
      filters: {},
      handler: async () => {
        callOrder.push('handler');
        return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
      },
    });

    const { event, context } = lexHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
  });

  test('allows middleware to skip a record by not calling next', async ({ lexHandlerEvent }) => {
    const handler = vi.fn();

    async function skipMiddleware(_request: LexRequest, _next: LexNext): Promise<LexV2Result> {
      return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
    }

    const matcher = createLexMatcher({ middleware: [skipMiddleware] });
    matcher.route({ filters: {}, handler });

    const { event, context } = lexHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(handler).not.toHaveBeenCalled();
  });

  test('executes multiple matcher-level middleware in order', async ({ lexHandlerEvent }) => {
    const callOrder: string[] = [];

    async function middlewareOne(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('mw1');
      return next(request);
    }

    async function middlewareTwo(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('mw2');
      return next(request);
    }

    const matcher = createLexMatcher({ middleware: [middlewareOne, middlewareTwo] });
    matcher.route({
      filters: {},
      handler: async () => {
        callOrder.push('handler');
        return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
      },
    });

    const { event, context } = lexHandlerEvent();
    await matcher.handleEvent(event, context);

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

    matcher.route({
      filters: {},
      middleware: [routeMiddleware],
      handler: async () => {
        callOrder.push('handler');
        return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
      },
    });

    const { event, context } = lexHandlerEvent();
    await matcher.handleEvent(event, context);

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

    matcher.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

    const { event, context } = lexHandlerEvent();
    await matcher.handleEvent(event, context);

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

    matcher.route({
      filters: {},
      middleware: [routeMiddlewareOne, routeMiddlewareTwo],
      handler: async () => {
        callOrder.push('handler');
        return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
      },
    });

    const { event, context } = lexHandlerEvent();
    await matcher.handleEvent(event, context);

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

    matcher.route(route);

    const { event, context } = lexHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(callOrder).toEqual(['route-mw', 'handler']);
  });
});

suite('combined matcher and route middleware', () => {
  test('executes matcher middleware before route middleware', async ({ lexHandlerEvent }) => {
    const callOrder: string[] = [];

    async function matcherMiddleware(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('matcher-mw');
      return next(request);
    }

    async function routeMiddleware(request: LexRequest, next: LexNext): Promise<LexV2Result> {
      callOrder.push('route-mw');
      return next(request);
    }

    const matcher = createLexMatcher({ middleware: [matcherMiddleware] });
    matcher.route({
      filters: {},
      middleware: [routeMiddleware],
      handler: async () => {
        callOrder.push('handler');
        return { sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } } };
      },
    });

    const { event, context } = lexHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
  });

  test('matcher middleware short-circuit prevents route middleware from running', async ({ lexHandlerEvent }) => {
    const routeMiddleware = vi.fn();
    const handler = vi.fn();
    const mockResult: LexV2Result = {
      sessionState: { dialogAction: { type: 'Close' }, intent: { name: 'Test', state: 'Fulfilled' } },
    };

    async function blockingMatcherMiddleware(_request: LexRequest, _next: LexNext): Promise<LexV2Result> {
      return mockResult;
    }

    const matcher = createLexMatcher({ middleware: [blockingMatcherMiddleware] });
    matcher.route({ filters: {}, middleware: [routeMiddleware], handler });

    const { event, context } = lexHandlerEvent();
    await matcher.handleEvent(event, context);

    expect(routeMiddleware).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});

suite('LexMatcher.canHandleEvent', () => {
  const ownEvents = ['createLexEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createLexMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
