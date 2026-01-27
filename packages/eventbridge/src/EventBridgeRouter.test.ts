import { createEventBridgeEvent, test } from '@lambda-event-router/testing';
import { createEventBridgeRouter, defineRoute, EventBridgeRouter } from './EventBridgeRouter.js';
import type { EventBridgeRequest } from './types.js';

describe('EventBridgeRouter', () => {
  describe('createEventBridgeRouter', () => {
    it('creates an EventBridgeRouter instance', () => {
      const router = createEventBridgeRouter();
      expect(router).toBeInstanceOf(EventBridgeRouter);
    });
  });

  describe('canHandleEvent', () => {
    it('returns true for an unknown event object', () => {
      const router = new EventBridgeRouter();
      const event = createEventBridgeEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    it('returns false for a known SQS event', () => {
      const router = new EventBridgeRouter();
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    it('returns false for a known SNS event', () => {
      const router = new EventBridgeRouter();
      const event = { Records: [{ EventSource: 'aws:sns' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    it('returns false for a known API Gateway V2 event', () => {
      const router = new EventBridgeRouter();
      const event = { rawPath: '/test', requestContext: { http: { method: 'GET' } } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    it('returns false for a known Cognito event', () => {
      const router = new EventBridgeRouter();
      const event = { triggerSource: 'PreSignUp_SignUp', userPoolId: 'us-east-1_TestPool' };
      expect(router.canHandleEvent(event)).toBe(false);
    });
  });

  describe('route', () => {
    it('returns the router instance for chaining', () => {
      const router = new EventBridgeRouter();
      const definition = defineRoute({
        filters: { sources: ['my.app'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  describe('handleEvent', () => {
    test('calls the matched handler with the parsed request', async ({ eventBridgeHandlerEvent }) => {
      const router = new EventBridgeRouter();
      const handler = vi.fn();
      const definition = defineRoute({
        filters: { sources: ['my.app'] },
      }).handle(handler);
      router.route(definition);

      const { event, context } = eventBridgeHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'my.app',
          detailType: 'OrderPlaced',
          detail: { orderId: '12345' },
          context,
        }),
      );
    });
  });

  describe('defineRoute', () => {
    it('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { sources: ['my.app'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });
  });

  describe('full event processing', () => {
    test('routes EventBridge events based on source filters', async ({ eventBridgeEvent, context }) => {
      const receivedOrderRequests: EventBridgeRequest[] = [];
      const receivedPaymentRequests: EventBridgeRequest[] = [];

      const router = createEventBridgeRouter();
      router.route(
        defineRoute({
          filters: { sources: ['order.service'] },
        }).handle(async (request) => {
          receivedOrderRequests.push(request);
        }),
      );
      router.route(
        defineRoute({
          filters: { sources: ['payment.service'] },
        }).handle(async (request) => {
          receivedPaymentRequests.push(request);
        }),
      );

      const event = eventBridgeEvent({
        source: 'order.service',
        'detail-type': 'OrderPlaced',
        detail: { orderId: '999' },
      });
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(receivedOrderRequests).toHaveLength(1);
      expect(receivedOrderRequests[0]).toEqual(
        expect.objectContaining({
          source: 'order.service',
          detailType: 'OrderPlaced',
          detail: { orderId: '999' },
          account: '123456789012',
          region: 'us-east-1',
          id: event.id,
          event,
          context: mockContext,
        }),
      );
      expect(receivedPaymentRequests).toHaveLength(0);
    });
  });
});
