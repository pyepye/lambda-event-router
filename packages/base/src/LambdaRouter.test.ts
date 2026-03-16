import { createMockContext, createSQSEvent } from '@lambda-event-router/testing';
import { createLambdaRouter, LambdaRouter } from './LambdaRouter.js';
import type { EventTypeRouter } from './types.js';

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

      // Class names matter — the constructor reorders based on constructor.name === 'EventRouter'
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

      // Pass EventRouter first — it should be moved to the end
      const lambdaRouter = createLambdaRouter({
        routers: [eventRouter, sqsRouter],
      });

      // @ts-expect-error accessing private property to check order of routers
      const orderedRouters: EventTypeRouter[] = lambdaRouter.routers;

      expect(orderedRouters[0]).toBe(sqsRouter);
      expect(orderedRouters[1]).toBe(eventRouter);
    });
  });
});
