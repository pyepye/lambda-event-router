import { createMockContext, createSQSEvent } from '@lambda-event-router/testing';
import { createEventRouter, EventRouter } from './EventRouter.js';
import type { EventTypeRouter } from './types.js';

suite('EventRouter', () => {
  suite('createEventRouter', () => {
    test('creates an EventRouter instance', () => {
      const router = createEventRouter({ routers: [] });
      expect(router).toBeInstanceOf(EventRouter);
    });
  });

  suite('handler', () => {
    test('returns a function', () => {
      const router = createEventRouter({ routers: [] });
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
      const eventRouter = createEventRouter({
        routers: [mockSNSRouter, mockSQSRouter],
      });
      const handler = eventRouter.handler();

      const sqsEvent = createSQSEvent();
      const mockContext = createMockContext();
      await handler(sqsEvent, mockContext, vi.fn());

      expect(sqsHandler).toHaveBeenCalledWith(sqsEvent, mockContext);
      expect(snsHandler).not.toHaveBeenCalled();
    });

    test('throws when no router matches the event', async () => {
      const eventRouter = createEventRouter({ routers: [] });
      const handler = eventRouter.handler();

      const unknownEvent = { unknown: true };
      const mockContext = createMockContext();

      await expect(handler(unknownEvent, mockContext, vi.fn())).rejects.toThrow('No router found for event');
    });

    test('reorders EventBridgeRouter to the end regardless of input order', () => {
      const mockHandler = vi.fn();

      // Class names matter — the constructor reorders based on constructor.name === 'EventBridgeRouter'
      class EventBridgeRouter implements EventTypeRouter {
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

      const eventBridgeRouter = new EventBridgeRouter();
      const sqsRouter = new SQSRouter();

      // Pass EventBridgeRouter first — it should be moved to the end
      const eventRouter = createEventRouter({
        routers: [eventBridgeRouter, sqsRouter],
      });

      // @ts-expect-error accessing private property to check order of routers
      const orderedRouters: EventTypeRouter[] = eventRouter.routers;

      expect(orderedRouters[0]).toBe(sqsRouter);
      expect(orderedRouters[1]).toBe(eventBridgeRouter);
    });
  });
});
