import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import { createMockContext, createSQSEvent } from '@latcher/testing';

import { createEventMatcher } from '../EventMatcher/index.js';
import { NoRouteMatchedError } from '../errors/index.js';
import { Logger, setLogger } from '../logger/index.js';
import { createLatcher, Latcher } from './Latcher.js';
import type { EventTypeMatcher } from './types.js';

type LambdaNext = (event: unknown, context: Context) => Promise<unknown>;

suite('Latcher', () => {
  suite('createLatcher', () => {
    test('creates an Latcher instance', () => {
      const matcher = createLatcher({ matchers: [] });
      expect(matcher).toBeInstanceOf(Latcher);
    });
  });

  suite('handler', () => {
    test('returns a function', () => {
      const matcher = createLatcher({ matchers: [] });
      const handler = matcher.handler();
      expect(typeof handler).toBe('function');
    });
  });

  suite('full event processing', () => {
    test('delegates to the correct matcher based on canHandleEvent', async () => {
      const sqsHandler = vi.fn();
      const snsHandler = vi.fn();

      const mockSQSMatcher: EventTypeMatcher = {
        canHandleEvent(event: unknown): event is unknown {
          const typed = event as { Records?: Array<{ eventSource?: string }> };
          return Array.isArray(typed?.Records) && typed.Records[0]?.eventSource === 'aws:sqs';
        },
        handleEvent: sqsHandler,
      };

      const mockSNSMatcher: EventTypeMatcher = {
        canHandleEvent(event: unknown): event is unknown {
          const typed = event as { Records?: Array<{ EventSource?: string }> };
          return Array.isArray(typed?.Records) && typed.Records[0]?.EventSource === 'aws:sns';
        },
        handleEvent: snsHandler,
      };

      // Put SNSMatcher first to test that SQSMatcher is correctly used for SQS events
      const latcher = createLatcher({
        matchers: [mockSNSMatcher, mockSQSMatcher],
      });
      const handler = latcher.handler();

      const sqsEvent = createSQSEvent();
      const mockContext = createMockContext();
      await handler(sqsEvent, mockContext, vi.fn());

      expect(sqsHandler).toHaveBeenCalledWith(sqsEvent, mockContext);
      expect(snsHandler).not.toHaveBeenCalled();
    });

    test('throws when no matcher matches the event', async () => {
      const latcher = createLatcher({ matchers: [] });
      const handler = latcher.handler();

      const unknownEvent = { unknown: true };
      const mockContext = createMockContext();

      await expect(handler(unknownEvent, mockContext, vi.fn())).rejects.toThrow('No matcher found for event');
    });
  });

  suite('matcher ordering', () => {
    function createOrderingMatcher(matchTier?: 'catchAll' | 'fallback'): EventTypeMatcher {
      return {
        matchTier,
        canHandleEvent(_event: unknown): _event is unknown {
          return true;
        },
        handleEvent: vi.fn(),
      };
    }

    function orderOf(matchers: EventTypeMatcher[]): EventTypeMatcher[] {
      const latcher = createLatcher({ matchers });
      // @ts-expect-error reading private state to check order of matchers
      return latcher.matchers;
    }

    test('sorts a fallback matcher last regardless of input order', () => {
      const specific = createOrderingMatcher();
      const fallback = createOrderingMatcher('fallback');

      expect(orderOf([fallback, specific])).toEqual([specific, fallback]);
    });

    test('sorts a catch-all after specific matchers and before a fallback', () => {
      const specific = createOrderingMatcher();
      const catchAll = createOrderingMatcher('catchAll');
      const fallback = createOrderingMatcher('fallback');

      expect(orderOf([fallback, catchAll, specific])).toEqual([specific, catchAll, fallback]);
    });

    test('keys off matchTier not the class name, so minification cannot break it', () => {
      // A minifier renames classes, so the sort must not depend on constructor.name.
      class Renamed implements EventTypeMatcher {
        readonly matchTier = 'fallback';
        canHandleEvent(_event: unknown): _event is unknown {
          return true;
        }
        handleEvent = vi.fn();
      }
      const specific = createOrderingMatcher();
      const fallback = new Renamed();

      expect(orderOf([fallback, specific])).toEqual([specific, fallback]);
    });

    test('sorts a real EventMatcher last as the fallback', () => {
      const specific = createOrderingMatcher();
      const eventMatcher = createEventMatcher();

      const ordered = orderOf([eventMatcher, specific]);
      expect(ordered[ordered.length - 1]).toBe(eventMatcher);
    });

    test('preserves registration order among specific matchers', () => {
      const first = createOrderingMatcher();
      const second = createOrderingMatcher();
      const fallback = createOrderingMatcher('fallback');

      expect(orderOf([first, second, fallback])).toEqual([first, second, fallback]);
    });
  });

  suite('falling through on NoRouteMatchedError', () => {
    function createClaimingMatcher(handleEvent: EventTypeMatcher['handleEvent']): EventTypeMatcher {
      return {
        canHandleEvent(_event: unknown): _event is unknown {
          return true;
        },
        handleEvent,
      };
    }

    test('tries the next matcher when the first claims the event and matches no route', async () => {
      const first = createClaimingMatcher(vi.fn().mockRejectedValue(new NoRouteMatchedError('No route matched')));
      const second = createClaimingMatcher(vi.fn().mockResolvedValue('second'));

      const handler = createLatcher({ matchers: [first, second] }).handler();
      const result = await handler({ command: 'generate-report' }, createMockContext(), vi.fn());

      expect(result).toBe('second');
      expect(second.handleEvent).toHaveBeenCalledOnce();
    });

    test('propagates any other error and never tries the next matcher', async () => {
      const first = createClaimingMatcher(vi.fn().mockRejectedValue(new Error('handler blew up')));
      const second = createClaimingMatcher(vi.fn().mockResolvedValue('second'));

      const handler = createLatcher({ matchers: [first, second] }).handler();

      await expect(handler({}, createMockContext(), vi.fn())).rejects.toThrow('handler blew up');
      expect(second.handleEvent).not.toHaveBeenCalled();
    });

    test('rethrows the last no-route error when every matcher that claimed the event missed', async () => {
      const first = createClaimingMatcher(vi.fn().mockRejectedValue(new NoRouteMatchedError('first matcher missed')));
      const second = createClaimingMatcher(vi.fn().mockRejectedValue(new NoRouteMatchedError('second matcher missed')));

      const handler = createLatcher({ matchers: [first, second] }).handler();

      await expect(handler({}, createMockContext(), vi.fn())).rejects.toThrow('second matcher missed');
    });

    test('still throws No matcher found for event when nothing claims it', async () => {
      const declining: EventTypeMatcher = {
        canHandleEvent(_event: unknown): _event is unknown {
          return false;
        },
        handleEvent: vi.fn(),
      };

      const handler = createLatcher({ matchers: [declining] }).handler();

      await expect(handler({}, createMockContext(), vi.fn())).rejects.toThrow('No matcher found for event');
      expect(declining.handleEvent).not.toHaveBeenCalled();
    });

    test('does not fall through when a route matches and its schema rejects', async () => {
      const eventSchema: StandardSchemaV1<{ orderId: string }> = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: () => ({ issues: [{ message: 'orderId is required' }] }),
        },
      };

      const validating = createEventMatcher().route({
        filters: { custom: () => true },
        eventSchema,
        handler: vi.fn(),
      });

      const secondHandler = vi.fn().mockResolvedValue('second');
      const second = createEventMatcher().route({ filters: { custom: () => true }, handler: secondHandler });

      const handler = createLatcher({ matchers: [validating, second] }).handler();

      await expect(handler({ nothingUseful: true }, createMockContext(), vi.fn())).rejects.toThrow(
        'Schema validation failed for event',
      );
      expect(secondHandler).not.toHaveBeenCalled();
    });
  });

  suite('handleEventWithMiddleware', () => {
    test('calls handler directly with no middleware', async () => {
      const handler = vi.fn().mockResolvedValue('result');
      const context = createMockContext();

      const latcher = createLatcher({ matchers: [], middleware: [] });

      // @ts-expect-error - testing private method
      const result = await latcher.handleEventWithMiddleware({ type: 'test' }, context, handler);

      expect(handler).toHaveBeenCalledWith({ type: 'test' }, context);
      expect(result).toBe('result');
    });

    test('executes middleware in order with event and context', async () => {
      const callOrder: string[] = [];
      const context = createMockContext();

      async function middlewareOne(event: unknown, ctx: Context, next: LambdaNext): Promise<unknown> {
        callOrder.push('mw1-pre');
        const result = await next(event, ctx);
        callOrder.push('mw1-post');
        return result;
      }

      async function middlewareTwo(event: unknown, ctx: Context, next: LambdaNext): Promise<unknown> {
        callOrder.push('mw2-pre');
        const result = await next(event, ctx);
        callOrder.push('mw2-post');
        return result;
      }

      async function handler(): Promise<unknown> {
        callOrder.push('handler');
        return 'result';
      }

      const latcher = createLatcher({ matchers: [], middleware: [middlewareOne, middlewareTwo] });

      // @ts-expect-error - testing private method
      await latcher.handleEventWithMiddleware({ type: 'test' }, context, handler);

      expect(callOrder).toEqual(['mw1-pre', 'mw2-pre', 'handler', 'mw2-post', 'mw1-post']);
    });

    test('allows middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn().mockResolvedValue('result');
      const context = createMockContext();

      async function blockingMiddleware(_event: unknown, _ctx: Context, _next: LambdaNext): Promise<unknown> {
        return 'blocked';
      }

      const latcher = createLatcher({ matchers: [], middleware: [blockingMiddleware] });

      // @ts-expect-error - testing private method
      const result = await latcher.handleEventWithMiddleware({ type: 'test' }, context, handler);

      expect(result).toBe('blocked');
      expect(handler).not.toHaveBeenCalled();
    });

    test('allows middleware to modify the result after calling next', async () => {
      const context = createMockContext();

      async function handler(): Promise<unknown> {
        return { statusCode: 200, body: 'original' };
      }

      async function modifyResult(event: unknown, ctx: Context, next: LambdaNext): Promise<unknown> {
        const result = await next(event, ctx);
        return { ...(result as Record<string, unknown>), modified: true };
      }

      const latcher = createLatcher({ matchers: [], middleware: [modifyResult] });

      // @ts-expect-error - testing private method
      const result = await latcher.handleEventWithMiddleware({ type: 'test' }, context, handler);

      expect(result).toEqual({ statusCode: 200, body: 'original', modified: true });
    });

    test('propagates errors from the handler through middleware', async () => {
      const context = createMockContext();

      async function handler(): Promise<unknown> {
        throw new Error('handler error');
      }

      async function middleware(event: unknown, ctx: Context, next: LambdaNext): Promise<unknown> {
        return next(event, ctx);
      }

      const latcher = createLatcher({ matchers: [], middleware: [middleware] });

      // @ts-expect-error - testing private method
      await expect(latcher.handleEventWithMiddleware({ type: 'test' }, context, handler)).rejects.toThrow(
        'handler error',
      );
    });
  });

  suite('middleware', () => {
    function createMockMatcher(handlerResult: unknown): EventTypeMatcher {
      return {
        canHandleEvent(event: unknown): event is unknown {
          return true;
        },
        handleEvent: vi.fn().mockResolvedValue(handlerResult),
      };
    }

    test('executes middleware before routing the event', async () => {
      const callOrder: string[] = [];
      const mockMatcher = createMockMatcher('result');
      const originalHandleEvent = mockMatcher.handleEvent;
      mockMatcher.handleEvent = vi.fn().mockImplementation((event: unknown, context: Context) => {
        callOrder.push('matcher');
        return originalHandleEvent(event, context);
      });

      async function middleware(event: unknown, ctx: Context, next: LambdaNext): Promise<unknown> {
        callOrder.push('mw-pre');
        const result = await next(event, ctx);
        callOrder.push('mw-post');
        return result;
      }

      const latcher = createLatcher({
        matchers: [mockMatcher],
        middleware: [middleware],
      });

      const handler = latcher.handler();
      await handler({}, createMockContext(), vi.fn());

      expect(callOrder).toEqual(['mw-pre', 'matcher', 'mw-post']);
    });

    test('allows middleware to short-circuit and prevent routing', async () => {
      const mockMatcher = createMockMatcher('result');

      async function blockingMiddleware(_event: unknown, _ctx: Context, _next: LambdaNext): Promise<unknown> {
        return 'blocked';
      }

      const latcher = createLatcher({
        matchers: [mockMatcher],
        middleware: [blockingMiddleware],
      });

      const handler = latcher.handler();
      const result = await handler({}, createMockContext(), vi.fn());

      expect(result).toBe('blocked');
      expect(mockMatcher.handleEvent).not.toHaveBeenCalled();
    });

    test('executes multiple middleware in order', async () => {
      const callOrder: string[] = [];
      const mockMatcher = createMockMatcher('result');

      async function middlewareOne(event: unknown, ctx: Context, next: LambdaNext): Promise<unknown> {
        callOrder.push('mw1');
        return next(event, ctx);
      }

      async function middlewareTwo(event: unknown, ctx: Context, next: LambdaNext): Promise<unknown> {
        callOrder.push('mw2');
        return next(event, ctx);
      }

      const latcher = createLatcher({
        matchers: [mockMatcher],
        middleware: [middlewareOne, middlewareTwo],
      });

      const handler = latcher.handler();
      await handler({}, createMockContext(), vi.fn());

      expect(callOrder).toEqual(['mw1', 'mw2']);
    });

    test('works without middleware', async () => {
      const mockMatcher = createMockMatcher('result');

      const latcher = createLatcher({
        matchers: [mockMatcher],
      });

      const handler = latcher.handler();
      const result = await handler({}, createMockContext(), vi.fn());

      expect(result).toBe('result');
    });
  });

  suite('logger key reset', () => {
    test('calls resetKeys on the active logger at the start of each invocation', async () => {
      const customLogger = new Logger({ logLevel: 'SILENT' });
      const resetKeysSpy = vi.spyOn(customLogger, 'resetKeys');
      setLogger(customLogger);

      const mockMatcher: EventTypeMatcher = {
        canHandleEvent(_event: unknown): _event is unknown {
          return true;
        },
        handleEvent: vi.fn().mockResolvedValue(undefined),
      };
      const latcher = createLatcher({ matchers: [mockMatcher] });
      const handler = latcher.handler();

      await handler({}, createMockContext(), vi.fn());
      expect(resetKeysSpy).toHaveBeenCalledTimes(1);

      await handler({}, createMockContext(), vi.fn());
      expect(resetKeysSpy).toHaveBeenCalledTimes(2);

      // Restore default logger so other tests are not affected.
      setLogger(new Logger({ logLevel: 'SILENT' }));
    });

    test('clears temporary keys appended during a previous invocation', async () => {
      const customLogger = new Logger({ logLevel: 'SILENT' });
      setLogger(customLogger);
      customLogger.appendKeys({ leaked: 'from-prior-invocation' });

      const mockMatcher: EventTypeMatcher = {
        canHandleEvent(_event: unknown): _event is unknown {
          return true;
        },
        handleEvent: vi.fn().mockImplementation(() => {
          customLogger.appendKeys({ fresh: 'this-invocation' });
          return Promise.resolve(undefined);
        }),
      };
      const latcher = createLatcher({ matchers: [mockMatcher] });
      const handler = latcher.handler();

      await handler({}, createMockContext(), vi.fn());

      // @ts-expect-error - reading private state to verify the reset happened
      expect(customLogger.temporaryKeys).toEqual({ fresh: 'this-invocation' });

      setLogger(new Logger({ logLevel: 'SILENT' }));
    });
  });
});
