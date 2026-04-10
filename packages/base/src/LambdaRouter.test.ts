import { createMockContext, createSQSEvent } from '@lambda-event-router/testing';
import type { Context } from 'aws-lambda';
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

    test('reorders EventRouter to the end regardless of input order', () => {
      const mockHandler = vi.fn();

      // The constructor reorders based on constructor.name === 'EventRouter'
      class EventRouter implements EventTypeRouter {
        canHandleEvent(event: unknown): event is unknown {
          return typeof event === 'object';
        }
        handleEvent = mockHandler;
      }

      class SQSRouter implements EventTypeRouter {
        canHandleEvent(event: unknown): event is unknown {
          return typeof event === 'object';
        }
        handleEvent = mockHandler;
      }

      const eventRouter = new EventRouter();
      const sqsRouter = new SQSRouter();

      const lambdaRouter = createLambdaRouter({
        routers: [eventRouter, sqsRouter],
      });

      // @ts-expect-error accessing private property to check order of routers
      const orderedRouters: EventTypeRouter[] = lambdaRouter.routers;

      expect(orderedRouters[0]).toBe(sqsRouter);
      expect(orderedRouters[1]).toBe(eventRouter);
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
});
