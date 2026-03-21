import type { Schema } from '@lambda-event-router/base';
import { createSNSEvent, test } from '@lambda-event-router/testing';
import { createSNSRouter, defineRoute, SNSRouter } from './SNSRouter.js';
import type { SNSFilterInput, SNSMessageAttributes, SNSRequest } from './types.js';

suite('SNSRouter', () => {
  suite('createSNSRouter', () => {
    test('creates an SNSRouter instance', () => {
      const router = createSNSRouter();
      expect(router).toBeInstanceOf(SNSRouter);
    });
  });

  suite('canHandleEvent', () => {
    let router: SNSRouter;

    beforeEach(() => {
      router = new SNSRouter();
    });

    test('returns true for a valid SNS event', () => {
      const event = createSNSEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for a non-SNS event', () => {
      const event = { detail: { foo: 'bar' }, source: 'custom.app' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when Records is not an array', () => {
      expect(router.canHandleEvent({ Records: 'not-an-array' })).toBe(false);
    });

    test('returns false when first record is not an object', () => {
      expect(router.canHandleEvent({ Records: ['not-an-object'] })).toBe(false);
    });

    test('returns false when EventSource is not aws:sns', () => {
      expect(router.canHandleEvent({ Records: [{ EventSource: 'aws:sqs' }] })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { topicArns: ['arn:aws:sns:us-east-1:123456789012:my-topic'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, schemas, and handler in the definition', () => {
      const bodySchema: Schema<{ action: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { action: string } }),
      };
      const messageAttributesSchema: Schema<SNSMessageAttributes> = {
        safeParse: (data: unknown) => ({ success: true, data: data as SNSMessageAttributes }),
      };
      const handler = vi.fn();
      const filters = {
        topicArns: ['arn:aws:sns:us-east-1:123456789012:my-topic'],
        messageAttributes: { eventType: ['order.created'] },
      };

      const definition = defineRoute({
        filters,
        bodySchema,
        messageAttributesSchema,
      }).handle(handler);

      expect(definition).toEqual({
        filters,
        bodySchema,
        messageAttributesSchema,
        handler,
      });
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const router = new SNSRouter();
      const definition = defineRoute({
        filters: { topicArns: ['arn:aws:sns:us-east-1:123456789012:my-topic'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    let router: SNSRouter;

    beforeEach(() => {
      router = createSNSRouter();
    });

    test('matches route by topicArns', ({ snsRecord }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('does not match route when topicArns does not match', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { topicArns: ['arn:aws:sns:us-east-1:123456789012:other-topic'] },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic' } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('matches route by subjects', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { subjects: ['Order Notification'] },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { Subject: 'Order Notification' } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('does not match route when subjects does not match', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { subjects: ['Shipping Update'] },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { Subject: 'Order Notification' } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('does not match when subject is undefined and subjects filter is set', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { subjects: ['Order Notification'] },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { Subject: undefined } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('matches route by messageAttributes', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.created'] } },
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({ Sns: { MessageAttributes: rawAttributes } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeDefined();
    });

    test('does not match route when messageAttributes does not match', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.shipped'] } },
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({ Sns: { MessageAttributes: rawAttributes } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeUndefined();
    });

    test('does not match when messageAttribute key is missing', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.created'] } },
        }).handle(async () => {}),
      );

      const rawAttributes = { otherKey: { Type: 'String', Value: 'some-value' } };
      const record = snsRecord({ Sns: { MessageAttributes: rawAttributes } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeUndefined();
    });

    test('matches when messageAttribute value is one of multiple allowed values', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.created', 'order.updated'] } },
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.updated' } };
      const record = snsRecord({ Sns: { MessageAttributes: rawAttributes } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeDefined();
    });

    test('matches when all messageAttribute filter keys match', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: {
            messageAttributes: {
              eventType: ['order.created'],
              source: ['checkout-service'],
            },
          },
        }).handle(async () => {}),
      );

      const rawAttributes = {
        eventType: { Type: 'String', Value: 'order.created' },
        source: { Type: 'String', Value: 'checkout-service' },
      };
      const record = snsRecord({ Sns: { MessageAttributes: rawAttributes } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeDefined();
    });

    test('does not match when one of multiple messageAttribute filter keys does not match', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: {
            messageAttributes: {
              eventType: ['order.created'],
              source: ['checkout-service'],
            },
          },
        }).handle(async () => {}),
      );

      const rawAttributes = {
        eventType: { Type: 'String', Value: 'order.created' },
        source: { Type: 'String', Value: 'inventory-service' },
      };
      const record = snsRecord({ Sns: { MessageAttributes: rawAttributes } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeUndefined();
    });

    test('matches route when both topicArns and subjects match', ({ snsRecord }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: {
            topicArns: [topicArn],
            subjects: ['Order Notification'],
          },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn, Subject: 'Order Notification' } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('does not match when topicArns matches but subjects does not', ({ snsRecord }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: {
            topicArns: [topicArn],
            subjects: ['Shipping Update'],
          },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn, Subject: 'Order Notification' } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('does not match when subjects matches but topicArns does not', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: {
            topicArns: ['arn:aws:sns:us-east-1:123456789012:other-topic'],
            subjects: ['Order Notification'],
          },
        }).handle(async () => {}),
      );

      const record = snsRecord({
        Sns: { TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic', Subject: 'Order Notification' },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('matches route when topicArns, subjects, and messageAttributes all match', ({ snsRecord }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: {
            topicArns: [topicArn],
            subjects: ['Order Notification'],
            messageAttributes: { eventType: ['order.created'] },
          },
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({
        Sns: { TopicArn: topicArn, Subject: 'Order Notification', MessageAttributes: rawAttributes },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeDefined();
    });

    test('does not match when topicArns and subjects match but messageAttributes does not', ({ snsRecord }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: {
            topicArns: [topicArn],
            subjects: ['Order Notification'],
            messageAttributes: { eventType: ['order.shipped'] },
          },
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({
        Sns: { TopicArn: topicArn, Subject: 'Order Notification', MessageAttributes: rawAttributes },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeUndefined();
    });

    test('customFilter is not evaluated when topicArns does not match', ({ snsRecord }) => {
      const customFilter = vi.fn(() => true);
      router.route(
        defineRoute({
          filters: {
            topicArns: ['arn:aws:sns:us-east-1:123456789012:other-topic'],
            customFilter,
          },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic' } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
      expect(customFilter).not.toHaveBeenCalled();
    });

    test('customFilter is evaluated when other filters match', ({ snsRecord }) => {
      const customFilter = vi.fn(() => true);
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: {
            topicArns: [topicArn],
            customFilter,
          },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
      expect(customFilter).toHaveBeenCalledOnce();
    });

    test('customFilter receives body, messageAttributes, and record', ({ snsRecord }) => {
      const customFilter = vi.fn(() => true);
      router.route(
        defineRoute({
          filters: { customFilter },
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({ Sns: { MessageAttributes: rawAttributes } });
      const body = { action: 'processOrder' };
      // @ts-expect-error - testing private method directly
      router.matchRoute(record, body, rawAttributes);

      expect(customFilter).toHaveBeenCalledWith({
        body,
        messageAttributes: rawAttributes,
        record,
      });
    });

    test('matches route by customFilter', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ body }: SNSFilterInput): boolean => {
              // @ts-expect-error - body is unknown, testing filter with known shape
              return body.action === 'processOrder';
            },
          },
        }).handle(async () => {}),
      );

      const record = snsRecord();
      const body = { action: 'processOrder' };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, body, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const record = snsRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('matches route with empty filters as a catch-all', ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const record = snsRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', ({ snsRecord }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.route(
        defineRoute({
          filters: { topicArns: ['arn:aws:sns:us-east-1:123456789012:my-topic'] },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { topicArns: ['arn:aws:sns:us-east-1:123456789012:my-topic'] },
        }).handle(secondHandler),
      );

      const record = snsRecord({ Sns: { TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic' } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
      // @ts-expect-error - result is asserted as defined above
      expect(result.handler).toBe(firstHandler);
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler with the parsed request', async ({ snsRecord, snsHandlerEvent }) => {
      const router = new SNSRouter();
      const handler = vi.fn();
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const body = { action: 'processOrder', orderId: '12345' };
      const definition = defineRoute({
        filters: { topicArns: [topicArn] },
      }).handle(handler);
      router.route(definition);

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({
        Sns: {
          TopicArn: topicArn,
          Message: JSON.stringify(body),
          MessageAttributes: rawAttributes,
        },
      });
      const { event, context } = snsHandlerEvent({ records: [record] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          body,
          messageAttributes: { eventType: 'order.created' },
          record: event.Records[0],
          context,
        }),
      );
    });

    test('returns undefined when all records succeed', async ({ snsRecord, snsEvent, context }) => {
      const router = createSNSRouter();
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn } });
      const event = snsEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
    });

    test('throws when no route matches', async ({ snsHandlerEvent }) => {
      const router = createSNSRouter();

      const { event, context } = snsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler error when batchItemFailures is disabled', async ({ snsHandlerEvent }) => {
      const router = createSNSRouter();
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
        }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = snsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('calls the handler for every matching record', async ({ snsRecord, snsEvent, context }) => {
      const router = createSNSRouter();
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const handler = vi.fn();

      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
        }).handle(handler),
      );

      const records = [
        snsRecord({ Sns: { TopicArn: topicArn } }),
        snsRecord({ Sns: { TopicArn: topicArn } }),
        snsRecord({ Sns: { TopicArn: topicArn } }),
      ];
      const event = snsEvent(records);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(3);
    });

    test('handler receives raw string when SNS message is not JSON', async ({ snsRecord, snsEvent, context }) => {
      const router = createSNSRouter();
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const handler = vi.fn();

      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
        }).handle(handler),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn, Message: 'plain text notification' } });
      const event = snsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: 'plain text notification' }));
    });

    test('processes records in parallel', async ({ snsRecord, snsEvent, context }) => {
      const router = createSNSRouter();
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const callOrder: string[] = [];

      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
        }).handle(async (request) => {
          const messageId = request.record.Sns.MessageId;
          callOrder.push(`start-${messageId}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${messageId}`);
        }),
      );

      const recordA = snsRecord({ Sns: { TopicArn: topicArn } });
      const recordB = snsRecord({ Sns: { TopicArn: topicArn } });
      const event = snsEvent([recordA, recordB]);
      await router.handleEvent(event, context());

      // Parallel: both start before either finishes
      expect(callOrder[0]).toBe(`start-${recordA.Sns.MessageId}`);
      expect(callOrder[1]).toBe(`start-${recordB.Sns.MessageId}`);
    });
  });

  suite('handleEvent - batchItemFailures', () => {
    test('returns undefined when all records succeed', async ({ snsRecord, snsEvent, context }) => {
      const router = createSNSRouter({ batchItemFailures: true });
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
        }).handle(async () => {}),
      );

      const records = [
        snsRecord({ Sns: { TopicArn: topicArn } }),
        snsRecord({ Sns: { TopicArn: topicArn } }),
        snsRecord({ Sns: { TopicArn: topicArn } }),
      ];
      const event = snsEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
    });

    test('does not throw when handler fails', async ({ snsRecord, snsEvent, context }) => {
      const router = createSNSRouter({ batchItemFailures: true });
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';

      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
        }).handle(async () => {
          throw new Error('processing failed');
        }),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn } });
      const event = snsEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
    });

    test('does not throw when no route matches', async ({ snsHandlerEvent }) => {
      const router = createSNSRouter({ batchItemFailures: true });

      const { event, context } = snsHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('returns undefined even when records fail', async ({ snsRecord, snsEvent, context }) => {
      const router = createSNSRouter({ batchItemFailures: true });
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const failingRecord = snsRecord({ Sns: { TopicArn: topicArn } });

      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
        }).handle(async (request) => {
          if (request.record.Sns.MessageId === failingRecord.Sns.MessageId) {
            throw new Error('processing failed');
          }
        }),
      );

      const records = [
        snsRecord({ Sns: { TopicArn: topicArn } }),
        failingRecord,
        snsRecord({ Sns: { TopicArn: topicArn } }),
      ];
      const event = snsEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
    });

    test('does not throw when schema validation fails', async ({ snsRecord, snsEvent, context }) => {
      const router = createSNSRouter({ batchItemFailures: true });
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const bodySchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
          bodySchema,
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn } });
      const event = snsEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
    });
  });

  suite('handleEvent - schema validation', () => {
    test('handler receives validated body from bodySchema', async ({ snsRecord, snsEvent, context }) => {
      const router = createSNSRouter();
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const handler = vi.fn();
      const transformedBody = { action: 'processOrder', orderId: '12345', validated: true };
      const bodySchema: Schema<typeof transformedBody> = {
        safeParse: () => ({ success: true, data: transformedBody }),
      };

      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
          bodySchema,
        }).handle(handler),
      );

      const record = snsRecord({
        Sns: {
          TopicArn: topicArn,
          Message: JSON.stringify({ action: 'processOrder', orderId: '12345' }),
        },
      });
      const event = snsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: transformedBody }));
    });

    test('throws when bodySchema validation fails and batchItemFailures is disabled', async ({
      snsRecord,
      snsEvent,
      context,
    }) => {
      const router = createSNSRouter();
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const bodySchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
          bodySchema,
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn } });
      const event = snsEvent([record]);

      await expect(router.handleEvent(event, context())).rejects.toThrow('Body validation failed');
    });

    test('handler receives validated attributes from messageAttributesSchema', async ({
      snsRecord,
      snsEvent,
      context,
    }) => {
      const router = createSNSRouter();
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const handler = vi.fn();
      const validatedAttributes = { eventType: 'order.created', extra: 'field' };
      const messageAttributesSchema: Schema<SNSMessageAttributes> = {
        safeParse: () => ({ success: true, data: validatedAttributes }),
      };

      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
          messageAttributesSchema,
        }).handle(handler),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({
        Sns: {
          TopicArn: topicArn,
          MessageAttributes: rawAttributes,
        },
      });
      const event = snsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ messageAttributes: validatedAttributes }));
    });

    test('throws when messageAttributesSchema validation fails and batchItemFailures is disabled', async ({
      snsRecord,
      snsEvent,
      context,
    }) => {
      const router = createSNSRouter();
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const messageAttributesSchema: Schema<SNSMessageAttributes> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      router.route(
        defineRoute({
          filters: { topicArns: [topicArn] },
          messageAttributesSchema,
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({
        Sns: {
          TopicArn: topicArn,
          MessageAttributes: rawAttributes,
        },
      });
      const event = snsEvent([record]);

      await expect(router.handleEvent(event, context())).rejects.toThrow('Message attributes validation failed');
    });
  });

  suite('parseJsonBody', () => {
    let router: SNSRouter;

    beforeEach(() => {
      router = new SNSRouter();
    });

    test('parses valid JSON body from record.Sns.Message', ({ snsRecord }) => {
      const record = snsRecord({ Sns: { Message: '{"greeting":"hello"}' } });

      // @ts-expect-error - testing private method directly
      const result = router.parseJsonBody(record);

      expect(result).toEqual({ greeting: 'hello' });
    });

    test('returns raw string when Message is not valid JSON', ({ snsRecord }) => {
      const record = snsRecord({ Sns: { Message: 'plain text message' } });

      // @ts-expect-error - testing private method directly
      const result = router.parseJsonBody(record);

      expect(result).toBe('plain text message');
    });
  });

  suite('convertMessageAttributes', () => {
    let router: SNSRouter;

    beforeEach(() => {
      router = new SNSRouter();
    });

    test('converts raw attributes to plain key-value pairs', () => {
      const raw = {
        eventType: { Type: 'String', Value: 'order.created' },
        priority: { Type: 'String', Value: 'high' },
        source: { Type: 'String', Value: 'checkout-service' },
      };

      // @ts-expect-error - testing private method directly
      const result = router.convertMessageAttributes(raw);

      expect(result).toEqual({
        eventType: 'order.created',
        priority: 'high',
        source: 'checkout-service',
      });
    });

    test('returns empty object for empty attributes', () => {
      // @ts-expect-error - testing private method directly
      const result = router.convertMessageAttributes({});

      expect(result).toEqual({});
    });
  });

  suite('validateBody', () => {
    let router: SNSRouter;

    beforeEach(() => {
      router = new SNSRouter();
    });

    test('returns validated data when bodySchema succeeds', ({ snsRecord }) => {
      const record = snsRecord();
      const body = { action: 'processOrder', orderId: '12345' };
      const validatedData = { ...body, validated: true };
      const schema: Schema<typeof validatedData> = {
        safeParse: () => ({ success: true, data: validatedData }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateBody(body, schema, record.Sns.MessageId);

      expect(result).toEqual(validatedData);
    });

    test('throws when bodySchema validation fails', ({ snsRecord }) => {
      const record = snsRecord();
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid body') }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateBody({}, schema, record.Sns.MessageId)).toThrow(
        `Body validation failed for record ${record.Sns.MessageId}`,
      );
    });

    test('returns body unchanged when no schema is provided', ({ snsRecord }) => {
      const record = snsRecord();
      const body = { action: 'processOrder' };

      // @ts-expect-error - testing private method directly
      const result = router.validateBody(body, undefined, record.Sns.MessageId);

      expect(result).toBe(body);
    });

    test('throws when body is a string and schema is provided', ({ snsRecord }) => {
      const record = snsRecord();
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('expected object, received string') }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateBody('not valid json', schema, record.Sns.MessageId)).toThrow(
        `Body validation failed for record ${record.Sns.MessageId}`,
      );
    });
  });

  suite('validateMessageAttributes', () => {
    let router: SNSRouter;

    beforeEach(() => {
      router = new SNSRouter();
    });

    test('returns validated attributes when messageAttributesSchema succeeds', ({ snsRecord }) => {
      const record = snsRecord();
      const messageAttributes = { eventType: 'order.created' };
      const validatedAttributes = { eventType: 'order.created', extra: 'field' };
      const schema: Schema<SNSMessageAttributes> = {
        safeParse: () => ({ success: true, data: validatedAttributes }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateMessageAttributes(messageAttributes, schema, record.Sns.MessageId);

      expect(result).toEqual(validatedAttributes);
    });

    test('throws when messageAttributesSchema validation fails', ({ snsRecord }) => {
      const record = snsRecord();
      const schema: Schema<SNSMessageAttributes> = {
        safeParse: () => ({ success: false, error: new Error('invalid attributes') }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateMessageAttributes({}, schema, record.Sns.MessageId)).toThrow(
        `Message attributes validation failed for record ${record.Sns.MessageId}`,
      );
    });

    test('returns messageAttributes unchanged when no schema is provided', ({ snsRecord }) => {
      const record = snsRecord();
      const messageAttributes = { eventType: 'order.created' };

      // @ts-expect-error - testing private method directly
      const result = router.validateMessageAttributes(messageAttributes, undefined, record.Sns.MessageId);

      expect(result).toBe(messageAttributes);
    });
  });

  suite('full event processing', () => {
    test('routes an SNS event through multiple handlers and returns undefined', async ({
      snsRecord,
      snsEvent,
      context,
    }) => {
      const receivedCreateRequests: SNSRequest[] = [];
      const receivedDeleteRequests: SNSRequest[] = [];

      const router = createSNSRouter();
      const orderRoute = defineRoute({
        filters: {
          messageAttributes: { eventType: ['order.created'] },
        },
      }).handle(async (request) => {
        receivedCreateRequests.push(request);
      });
      router.route(orderRoute);

      const deleteRoute = defineRoute({
        filters: {
          messageAttributes: { eventType: ['order.deleted'] },
        },
      }).handle(async (request) => {
        receivedDeleteRequests.push(request);
      });
      router.route(deleteRoute);

      const body = { action: 'processOrder', orderId: '12345' };
      const serializedBody = JSON.stringify(body);
      const records = [
        snsRecord({
          Sns: {
            Message: serializedBody,
            MessageAttributes: { eventType: { Type: 'String', Value: 'order.created' } },
          },
        }),
        snsRecord({
          Sns: {
            Message: serializedBody,
            MessageAttributes: { eventType: { Type: 'String', Value: 'order.created' } },
          },
        }),
        snsRecord({
          Sns: {
            Message: serializedBody,
            MessageAttributes: { eventType: { Type: 'String', Value: 'order.deleted' } },
          },
        }),
      ];
      const event = snsEvent(records);
      const mockContext = context();
      const result = await router.handleEvent(event, mockContext);

      expect(result).toBeUndefined();
      expect(receivedCreateRequests).toHaveLength(2);
      expect(receivedCreateRequests[0]).toEqual(
        expect.objectContaining({
          body,
          messageAttributes: { eventType: 'order.created' },
          context: mockContext,
        }),
      );

      expect(receivedDeleteRequests).toHaveLength(1);
      expect(receivedDeleteRequests[0]).toEqual(
        expect.objectContaining({
          body,
          messageAttributes: { eventType: 'order.deleted' },
          context: mockContext,
        }),
      );
    });
  });
});
