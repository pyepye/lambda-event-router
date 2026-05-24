import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import { createMockContext, createSQSEvent } from '@lambda-event-router/testing';

import { createEventRouter } from '../EventRouter/index.js';
import { NoRouteMatchedError } from '../errors/index.js';
import { Logger, setLogger } from '../logger/index.js';
import { createLambdaRouter, LambdaRouter } from './LambdaRouter.js';
import type { EventTypeRouter } from './types.js';

type LambdaNext = (event: unknown, context: Context) => Promise<unknown>;

suite('LambdaRouter', () => {
  suite('createLambdaRouter', () => {
    test('creates an LambdaRouter instance', () => {
      const router = createLambdaRouter({ routers: [] });
      expect(router).toBeInstanceOf(LambdaRouter);
    });
  });

  suite('handler', () => {
    test('returns a function', () => {
      const router = createLambdaRouter({ routers: [] });
      const handler = router.handler();
      expect(typeof handler).toBe('function');
    });
  });

  suite('full event processing', () => {
    test('delegates to the correct router based on canHandleEvent', async () => {
      const sqsHandler = vi.fn();
      const snsHandler = vi.fn();

      const mockSQSRouter: EventTypeRouter = {
        canHandleEvent(event: unknown): event is unknown {
          const typed = event as { Records?: Array<{ eventSource?: string }> };
          return Array.isArray(typed?.Records) && typed.Records[0]?.eventSource === 'aws:sqs';
        },
        handleEvent: sqsHandler,
      };

      const mockSNSRouter: EventTypeRouter = {
        canHandleEvent(event: unknown): event is unknown {
          const typed = event as { Records?: Array<{ EventSource?: string }> };
          return Array.isArray(typed?.Records) && typed.Records[0]?.EventSource === 'aws:sns';
        },
        handleEvent: snsHandler,
      };

      // Put SNSRouter first to test that SQSRouter is correctly used for SQS events
      const lambdaRouter = createLambdaRouter({
        routers: [mockSNSRouter, mockSQSRouter],
      });
      const handler = lambdaRouter.handler();

      const sqsEvent = createSQSEvent();
      const mockContext = createMockContext();
      await handler(sqsEvent, mockContext, vi.fn());

      expect(sqsHandler).toHaveBeenCalledWith(sqsEvent, mockContext);
      expect(snsHandler).not.toHaveBeenCalled();
    });

    test('throws when no router matches the event', async () => {
      const lambdaRouter = createLambdaRouter({ routers: [] });
      const handler = lambdaRouter.handler();

      const unknownEvent = { unknown: true };
      const mockContext = createMockContext();

      await expect(handler(unknownEvent, mockContext, vi.fn())).rejects.toThrow('No router found for event');
    });
  });

  suite('router ordering', () => {
    function createOrderingRouter(matchTier?: 'catchAll' | 'fallback'): EventTypeRouter {
      return {
        matchTier,
        canHandleEvent(_event: unknown): _event is unknown {
          return true;
        },
        handleEvent: vi.fn(),
      };
    }

    function orderOf(routers: EventTypeRouter[]): EventTypeRouter[] {
      const lambdaRouter = createLambdaRouter({ routers });
      // @ts-expect-error reading private state to check order of routers
      return lambdaRouter.routers;
    }

    test('sorts a fallback router last regardless of input order', () => {
      const specific = createOrderingRouter();
      const fallback = createOrderingRouter('fallback');

      expect(orderOf([fallback, specific])).toEqual([specific, fallback]);
    });

    test('sorts a catch-all after specific routers and before a fallback', () => {
      const specific = createOrderingRouter();
      const catchAll = createOrderingRouter('catchAll');
      const fallback = createOrderingRouter('fallback');

      expect(orderOf([fallback, catchAll, specific])).toEqual([specific, catchAll, fallback]);
    });

    test('keys off matchTier not the class name, so minification cannot break it', () => {
      // A minifier renames classes, so the sort must not depend on constructor.name.
      class Renamed implements EventTypeRouter {
        readonly matchTier = 'fallback';
        canHandleEvent(_event: unknown): _event is unknown {
          return true;
        }
        handleEvent = vi.fn();
      }
      const specific = createOrderingRouter();
      const fallback = new Renamed();

      expect(orderOf([fallback, specific])).toEqual([specific, fallback]);
    });

    test('sorts a real EventRouter last as the fallback', () => {
      const specific = createOrderingRouter();
      const eventRouter = createEventRouter();

      const ordered = orderOf([eventRouter, specific]);
      expect(ordered[ordered.length - 1]).toBe(eventRouter);
    });

    test('preserves registration order among specific routers', () => {
      const first = createOrderingRouter();
      const second = createOrderingRouter();
      const fallback = createOrderingRouter('fallback');

      expect(orderOf([first, second, fallback])).toEqual([first, second, fallback]);
    });
  });

  suite('falling through on NoRouteMatchedError', () => {
    function createClaimingRouter(handleEvent: EventTypeRouter['handleEvent']): EventTypeRouter {
      return {
        canHandleEvent(_event: unknown): _event is unknown {
          return true;
        },
        handleEvent,
      };
    }

    test('tries the next router when the first claims the event and matches no route', async () => {
      const first = createClaimingRouter(vi.fn().mockRejectedValue(new NoRouteMatchedError('No route matched')));
      const second = createClaimingRouter(vi.fn().mockResolvedValue('second'));

      const handler = createLambdaRouter({ routers: [first, second] }).handler();
      const result = await handler({ command: 'generate-report' }, createMockContext(), vi.fn());

      expect(result).toBe('second');
      expect(second.handleEvent).toHaveBeenCalledOnce();
    });

    test('propagates any other error and never tries the next router', async () => {
      const first = createClaimingRouter(vi.fn().mockRejectedValue(new Error('handler blew up')));
      const second = createClaimingRouter(vi.fn().mockResolvedValue('second'));

      const handler = createLambdaRouter({ routers: [first, second] }).handler();

      await expect(handler({}, createMockContext(), vi.fn())).rejects.toThrow('handler blew up');
      expect(second.handleEvent).not.toHaveBeenCalled();
    });

    test('rethrows the last no-route error when every router that claimed the event missed', async () => {
      const first = createClaimingRouter(vi.fn().mockRejectedValue(new NoRouteMatchedError('first router missed')));
      const second = createClaimingRouter(vi.fn().mockRejectedValue(new NoRouteMatchedError('second router missed')));

      const handler = createLambdaRouter({ routers: [first, second] }).handler();

      await expect(handler({}, createMockContext(), vi.fn())).rejects.toThrow('second router missed');
    });

    test('still throws No router found for event when nothing claims it', async () => {
      const declining: EventTypeRouter = {
        canHandleEvent(_event: unknown): _event is unknown {
          return false;
        },
        handleEvent: vi.fn(),
      };

      const handler = createLambdaRouter({ routers: [declining] }).handler();

      await expect(handler({}, createMockContext(), vi.fn())).rejects.toThrow('No router found for event');
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

      const validating = createEventRouter().route({
        filters: { custom: () => true },
        eventSchema,
        handler: vi.fn(),
      });

      const secondHandler = vi.fn().mockResolvedValue('second');
      const second = createEventRouter().route({ filters: { custom: () => true }, handler: secondHandler });

      const handler = createLambdaRouter({ routers: [validating, second] }).handler();

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

      const lambdaRouter = createLambdaRouter({ routers: [], middleware: [] });

      // @ts-expect-error - testing private method
      const result = await lambdaRouter.handleEventWithMiddleware({ type: 'test' }, context, handler);

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

      const lambdaRouter = createLambdaRouter({ routers: [], middleware: [middlewareOne, middlewareTwo] });

      // @ts-expect-error - testing private method
      await lambdaRouter.handleEventWithMiddleware({ type: 'test' }, context, handler);

      expect(callOrder).toEqual(['mw1-pre', 'mw2-pre', 'handler', 'mw2-post', 'mw1-post']);
    });

    test('allows middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn().mockResolvedValue('result');
      const context = createMockContext();

      async function blockingMiddleware(_event: unknown, _ctx: Context, _next: LambdaNext): Promise<unknown> {
        return 'blocked';
      }

      const lambdaRouter = createLambdaRouter({ routers: [], middleware: [blockingMiddleware] });

      // @ts-expect-error - testing private method
      const result = await lambdaRouter.handleEventWithMiddleware({ type: 'test' }, context, handler);

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

      const lambdaRouter = createLambdaRouter({ routers: [], middleware: [modifyResult] });

      // @ts-expect-error - testing private method
      const result = await lambdaRouter.handleEventWithMiddleware({ type: 'test' }, context, handler);

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

      const lambdaRouter = createLambdaRouter({ routers: [], middleware: [middleware] });

      // @ts-expect-error - testing private method
      await expect(lambdaRouter.handleEventWithMiddleware({ type: 'test' }, context, handler)).rejects.toThrow(
        'handler error',
      );
    });
  });

  suite('middleware', () => {
    function createMockRouter(handlerResult: unknown): EventTypeRouter {
      return {
        canHandleEvent(event: unknown): event is unknown {
          return true;
        },
        handleEvent: vi.fn().mockResolvedValue(handlerResult),
      };
    }

    test('executes middleware before routing the event', async () => {
      const callOrder: string[] = [];
      const mockRouter = createMockRouter('result');
      const originalHandleEvent = mockRouter.handleEvent;
      mockRouter.handleEvent = vi.fn().mockImplementation((event: unknown, context: Context) => {
        callOrder.push('router');
        return originalHandleEvent(event, context);
      });

      async function middleware(event: unknown, ctx: Context, next: LambdaNext): Promise<unknown> {
        callOrder.push('mw-pre');
        const result = await next(event, ctx);
        callOrder.push('mw-post');
        return result;
      }

      const lambdaRouter = createLambdaRouter({
        routers: [mockRouter],
        middleware: [middleware],
      });

      const handler = lambdaRouter.handler();
      await handler({}, createMockContext(), vi.fn());

      expect(callOrder).toEqual(['mw-pre', 'router', 'mw-post']);
    });

    test('allows middleware to short-circuit and prevent routing', async () => {
      const mockRouter = createMockRouter('result');

      async function blockingMiddleware(_event: unknown, _ctx: Context, _next: LambdaNext): Promise<unknown> {
        return 'blocked';
      }

      const lambdaRouter = createLambdaRouter({
        routers: [mockRouter],
        middleware: [blockingMiddleware],
      });

      const handler = lambdaRouter.handler();
      const result = await handler({}, createMockContext(), vi.fn());

      expect(result).toBe('blocked');
      expect(mockRouter.handleEvent).not.toHaveBeenCalled();
    });

    test('executes multiple middleware in order', async () => {
      const callOrder: string[] = [];
      const mockRouter = createMockRouter('result');

      async function middlewareOne(event: unknown, ctx: Context, next: LambdaNext): Promise<unknown> {
        callOrder.push('mw1');
        return next(event, ctx);
      }

      async function middlewareTwo(event: unknown, ctx: Context, next: LambdaNext): Promise<unknown> {
        callOrder.push('mw2');
        return next(event, ctx);
      }

      const lambdaRouter = createLambdaRouter({
        routers: [mockRouter],
        middleware: [middlewareOne, middlewareTwo],
      });

      const handler = lambdaRouter.handler();
      await handler({}, createMockContext(), vi.fn());

      expect(callOrder).toEqual(['mw1', 'mw2']);
    });

    test('works without middleware', async () => {
      const mockRouter = createMockRouter('result');

      const lambdaRouter = createLambdaRouter({
        routers: [mockRouter],
      });

      const handler = lambdaRouter.handler();
      const result = await handler({}, createMockContext(), vi.fn());

      expect(result).toBe('result');
    });
  });

  suite('logger key reset', () => {
    test('calls resetKeys on the active logger at the start of each invocation', async () => {
      const customLogger = new Logger({ logLevel: 'SILENT' });
      const resetKeysSpy = vi.spyOn(customLogger, 'resetKeys');
      setLogger(customLogger);

      const mockRouter: EventTypeRouter = {
        canHandleEvent(_event: unknown): _event is unknown {
          return true;
        },
        handleEvent: vi.fn().mockResolvedValue(undefined),
      };
      const lambdaRouter = createLambdaRouter({ routers: [mockRouter] });
      const handler = lambdaRouter.handler();

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

      const mockRouter: EventTypeRouter = {
        canHandleEvent(_event: unknown): _event is unknown {
          return true;
        },
        handleEvent: vi.fn().mockImplementation(() => {
          customLogger.appendKeys({ fresh: 'this-invocation' });
          return Promise.resolve(undefined);
        }),
      };
      const lambdaRouter = createLambdaRouter({ routers: [mockRouter] });
      const handler = lambdaRouter.handler();

      await handler({}, createMockContext(), vi.fn());

      // @ts-expect-error - reading private state to verify the reset happened
      expect(customLogger.temporaryKeys).toEqual({ fresh: 'this-invocation' });

      setLogger(new Logger({ logLevel: 'SILENT' }));
    });
  });
});
