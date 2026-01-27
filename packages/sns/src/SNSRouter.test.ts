import { createSNSEvent, test } from '@lambda-event-router/testing';
import { createSNSRouter, defineRoute, SNSRouter } from './SNSRouter.js';
import type { SNSRequest } from './types.js';

describe('SNSRouter', () => {
  describe('createSNSRouter', () => {
    it('creates an SNSRouter instance', () => {
      const router = createSNSRouter();
      expect(router).toBeInstanceOf(SNSRouter);
    });
  });

  describe('canHandleEvent', () => {
    it('returns true for a valid SNS event', () => {
      const router = new SNSRouter();
      const event = createSNSEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    it('returns false for a non-SNS event', () => {
      const router = new SNSRouter();
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });
  });

  describe('route', () => {
    it('returns the router instance for chaining', () => {
      const router = new SNSRouter();
      const definition = defineRoute({
        filters: { topicArns: ['arn:aws:sns:us-east-1:123456789012:my-topic'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  describe('handleEvent', () => {
    test('calls the matched handler with the parsed request', async ({ snsHandlerEvent }) => {
      const router = new SNSRouter();
      const handler = vi.fn();
      const definition = defineRoute({
        filters: { topicArns: ['arn:aws:sns:us-east-1:123456789012:my-topic'] },
      }).handle(handler);
      router.route(definition);

      const { event, context } = snsHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { action: 'processOrder', orderId: '12345' },
          messageAttributes: { eventType: 'order.created' },
          record: event.Records[0],
          context,
        }),
      );
    });
  });

  describe('defineRoute', () => {
    it('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { topicArns: ['arn:aws:sns:us-east-1:123456789012:my-topic'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });
  });

  describe('full event processing', () => {
    test('routes an SNS event through handlers based on messageAttributes', async ({
      snsRecord,
      snsEvent,
      context,
    }) => {
      const receivedCreateRequests: SNSRequest[] = [];
      const receivedDeleteRequests: SNSRequest[] = [];

      const router = createSNSRouter();
      const createRoute = defineRoute({
        filters: {
          messageAttributes: { eventType: ['order.created'] },
        },
      }).handle(async (request) => {
        receivedCreateRequests.push(request);
      });
      router.route(createRoute);

      const deleteRoute = defineRoute({
        filters: {
          messageAttributes: { eventType: ['order.deleted'] },
        },
      }).handle(async (request) => {
        receivedDeleteRequests.push(request);
      });
      router.route(deleteRoute);

      const records = [
        snsRecord({ Sns: { MessageAttributes: { eventType: { Type: 'String', Value: 'order.created' } } } }),
        snsRecord({ Sns: { MessageAttributes: { eventType: { Type: 'String', Value: 'order.created' } } } }),
        snsRecord({ Sns: { MessageAttributes: { eventType: { Type: 'String', Value: 'order.deleted' } } } }),
      ];
      const event = snsEvent(records);
      const mockContext = context();
      const result = await router.handleEvent(event, mockContext);

      expect(result).toBeUndefined();
      expect(receivedCreateRequests).toHaveLength(2);
      expect(receivedCreateRequests[0]).toEqual(
        expect.objectContaining({
          body: { action: 'processOrder', orderId: '12345' },
          messageAttributes: { eventType: 'order.created' },
          context: mockContext,
        }),
      );

      expect(receivedDeleteRequests).toHaveLength(1);
      expect(receivedDeleteRequests[0]).toEqual(
        expect.objectContaining({
          body: { action: 'processOrder', orderId: '12345' },
          messageAttributes: { eventType: 'order.deleted' },
          context: mockContext,
        }),
      );
    });
  });
});
