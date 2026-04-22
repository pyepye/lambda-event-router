import type { MockInstance } from 'vitest';

import * as base from '@lambda-event-router/base';
import { createMockSchema, createSNSEvent, test } from '@lambda-event-router/testing';

import { createSNSRouter, defineRoute, SNSRouter } from './SNSRouter.js';
import type { SNSFilterInput, SNSRequest } from './types.js';

type SNSNext = (request: SNSRequest) => Promise<void>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');
const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');

let router: SNSRouter;

beforeEach(() => {
  router = new SNSRouter();
});

suite('SNSRouter', () => {
  suite('createSNSRouter', () => {
    test('creates an SNSRouter instance', () => {
      const router = createSNSRouter();
      expect(router).toBeInstanceOf(SNSRouter);
    });
  });

  suite('canHandleEvent', () => {
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
        filters: { topicArn: ['arn:aws:sns:us-east-1:123456789012:my-topic'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, schemas, and handler in the definition', () => {
      const bodySchema = createMockSchema();
      const messageAttributesSchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        topicArn: ['arn:aws:sns:us-east-1:123456789012:my-topic'],
        messageAttributes: { eventType: 'order.created' },
      };

      const definition = defineRoute({
        filters,
        bodySchema,
        messageAttributesSchema,
      }).handle(handler);

      expect(definition.filters).toBe(filters);
      expect(definition.bodySchema).toBe(bodySchema);
      expect(definition.messageAttributesSchema).toBe(messageAttributesSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: { topicArn: ['arn:aws:sns:us-east-1:123456789012:my-topic'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches route by topicArn', async ({ snsRecord }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: { topicArn },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('matches route by topicArn array', async ({ snsRecord }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const topicArn2 = 'arn:aws:sns:eu-west-2:987654321098:other-topic';
      router.route(
        defineRoute({
          filters: { topicArn: [topicArn, topicArn2] },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('does not match route when topicArn does not match', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { topicArn: ['arn:aws:sns:us-east-1:123456789012:other-topic'] },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic' } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('matches route by subject', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { subject: 'Order Notification' },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { Subject: 'Order Notification' } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('matches route by subject array', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { subject: ['Order Notification', 'Refund Notification'] },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { Subject: 'Order Notification' } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('does not match route when subject does not match', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { subject: ['Shipping Update'] },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { Subject: 'Order Notification' } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('does not match when subject is undefined and subject filter is set', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { subject: 'Order Notification' },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { Subject: undefined } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('matches route by messageAttributes', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: 'order.created' } },
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({ Sns: { MessageAttributes: rawAttributes } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeDefined();
    });

    test('matches route by messageAttributes array', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.created', 'order.refunded'] } },
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({ Sns: { MessageAttributes: rawAttributes } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeDefined();
    });

    test('does not match route when messageAttributes does not match', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.shipped'] } },
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({ Sns: { MessageAttributes: rawAttributes } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeUndefined();
    });

    test('does not match when messageAttribute key is missing', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: 'order.created' } },
        }).handle(async () => {}),
      );

      const rawAttributes = { otherKey: { Type: 'String', Value: 'some-value' } };
      const record = snsRecord({ Sns: { MessageAttributes: rawAttributes } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeUndefined();
    });

    test('matches when all messageAttribute filter keys match', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: {
            messageAttributes: {
              eventType: 'order.created',
              source: 'checkout-service',
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
      const result = await router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeDefined();
    });

    test('does not match when one of multiple messageAttribute filter keys does not match', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: {
            messageAttributes: {
              eventType: 'order.created',
              source: 'checkout-service',
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
      const result = await router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeUndefined();
    });

    test('matches route when both topicArn and subject match', async ({ snsRecord }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: {
            topicArn,
            subject: 'Order Notification',
          },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn, Subject: 'Order Notification' } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('does not match when topicArn matches but subject does not', async ({ snsRecord }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: {
            topicArn,
            subject: ['Shipping Update'],
          },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn, Subject: 'Order Notification' } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('does not match when subject matches but topicArn does not', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: {
            topicArn: ['arn:aws:sns:us-east-1:123456789012:other-topic'],
            subject: 'Order Notification',
          },
        }).handle(async () => {}),
      );

      const record = snsRecord({
        Sns: { TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic', Subject: 'Order Notification' },
      });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('matches route when topicArn, subject, and messageAttributes all match', async ({ snsRecord }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: {
            topicArn,
            subject: 'Order Notification',
            messageAttributes: { eventType: 'order.created' },
          },
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({
        Sns: { TopicArn: topicArn, Subject: 'Order Notification', MessageAttributes: rawAttributes },
      });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeDefined();
    });

    test('does not match when topicArn and subject match but messageAttributes does not', async ({ snsRecord }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: {
            topicArn,
            subject: 'Order Notification',
            messageAttributes: { eventType: ['order.shipped'] },
          },
        }).handle(async () => {}),
      );

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const record = snsRecord({
        Sns: { TopicArn: topicArn, Subject: 'Order Notification', MessageAttributes: rawAttributes },
      });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, rawAttributes);

      expect(result).toBeUndefined();
    });

    test('customFilter is not evaluated when topicArn does not match', async ({ snsRecord }) => {
      const customFilter = vi.fn(() => true);
      router.route(
        defineRoute({
          filters: {
            topicArn: ['arn:aws:sns:us-east-1:123456789012:other-topic'],
            customFilter,
          },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic' } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
      expect(customFilter).not.toHaveBeenCalled();
    });

    test('customFilter is evaluated when other filters match', async ({ snsRecord }) => {
      const customFilter = vi.fn(() => true);
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: {
            topicArn,
            customFilter,
          },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
      expect(customFilter).toHaveBeenCalledOnce();
    });

    test('customFilter receives body, messageAttributes, and record', async ({ snsRecord }) => {
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
      await router.matchRoute(record, body, rawAttributes);

      expect(customFilter).toHaveBeenCalledWith({
        body,
        messageAttributes: rawAttributes,
        record,
      });
    });

    test('matches route by customFilter', async ({ snsRecord }) => {
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
      const result = await router.matchRoute(record, body, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('matches route by async customFilter', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: async ({ body }: SNSFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              // @ts-expect-error - body is unknown, testing filter with known shape
              return body.action === 'processOrder';
            },
          },
        }).handle(async () => {}),
      );

      const record = snsRecord();
      const body = { action: 'processOrder' };
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, body, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const record = snsRecord();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeUndefined();
    });

    test('matches route with empty filters as a catch-all', async ({ snsRecord }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const record = snsRecord();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', async ({ snsRecord }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(
        defineRoute({
          filters: { topicArn: ['arn:aws:sns:us-east-1:123456789012:my-topic'] },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { topicArn: ['arn:aws:sns:us-east-1:123456789012:my-topic'] },
        }).handle(secondHandler),
      );

      const record = snsRecord({ Sns: { TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic' } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, {}, record.Sns.MessageAttributes);

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler with the parsed request', async ({ snsRecord, snsHandlerEvent }) => {
      const handler = vi.fn();
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';

      const definition = defineRoute({
        filters: { topicArn },
      }).handle(handler);
      router.route(definition);

      const rawAttributes = { eventType: { Type: 'String', Value: 'order.created' } };
      const body = { action: 'processOrder', orderId: '12345' }; // Move this?
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
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: { topicArn },
        }).handle(async () => {}),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn } });
      const event = snsEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
    });

    test('throws when no route matches', async ({ snsHandlerEvent }) => {
      const { event, context } = snsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler error when batchItemFailures is disabled', async ({ snsHandlerEvent }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: { topicArn },
        }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = snsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('calls the handler for every matching record', async ({ snsRecord, snsEvent, context }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { topicArn },
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
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { topicArn },
        }).handle(handler),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn, Message: 'plain text notification' } });
      const event = snsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: 'plain text notification' }));
    });

    test('processes records in parallel', async ({ snsRecord, snsEvent, context }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const callOrder: string[] = [];
      router.route(
        defineRoute({
          filters: { topicArn },
        }).handle(async (request) => {
          const messageId = request.record.Sns.MessageId;
          callOrder.push(`start-${messageId}`);
          await new Promise((resolve) => setTimeout(resolve, 1));
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
    let router: SNSRouter;

    beforeAll(() => {
      router = new SNSRouter({ batchItemFailures: true });
    });

    test('returns undefined when all records succeed', async ({ snsRecord, snsEvent, context }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: { topicArn },
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
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      router.route(
        defineRoute({
          filters: { topicArn },
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
      const { event, context } = snsHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('returns undefined even when records fail', async ({ snsRecord, snsEvent, context }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const failingRecord = snsRecord({ Sns: { TopicArn: topicArn } });

      router.route(
        defineRoute({
          filters: { topicArn },
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
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.route(
        defineRoute({
          filters: { topicArn },
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
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const handler = vi.fn();
      const bodySchema = createMockSchema();

      router.route(
        defineRoute({
          filters: { topicArn },
          bodySchema,
        }).handle(handler),
      );

      const body = { action: 'processOrder', orderId: '12345' };
      const record = snsRecord({
        Sns: {
          TopicArn: topicArn,
          Message: JSON.stringify(body),
        },
      });
      const event = snsEvent([record]);
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith(body, bodySchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body }));
    });

    test('throws when bodySchema validation fails and batchItemFailures is disabled', async ({
      snsRecord,
      snsEvent,
      context,
    }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.route(
        defineRoute({
          filters: { topicArn },
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
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const handler = vi.fn();
      const messageAttributesSchema = createMockSchema();

      router.route(
        defineRoute({
          filters: { topicArn },
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

      expect(validateSchemaSpy).toHaveBeenCalledWith(
        { eventType: 'order.created' },
        messageAttributesSchema,
        expect.any(String),
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ messageAttributes: { eventType: 'order.created' } }),
      );
    });

    test('throws when messageAttributesSchema validation fails and batchItemFailures is disabled', async ({
      snsRecord,
      snsEvent,
      context,
    }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const messageAttributesSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.route(
        defineRoute({
          filters: { topicArn },
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

  suite('handleEvent - jsonParse', () => {
    test('passes SNS message to safeJsonParse', async ({ snsRecord, snsEvent, context }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { topicArn },
        }).handle(handler),
      );

      const message = JSON.stringify({ action: 'processOrder', orderId: '12345' });
      const record = snsRecord({ Sns: { TopicArn: topicArn, Message: message } });
      const event = snsEvent([record]);
      await router.handleEvent(event, context());

      expect(safeJsonParseSpy).toHaveBeenCalledWith(message);
    });

    test('handler receives parsed object when message is valid JSON', async ({ snsRecord, snsEvent, context }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { topicArn },
        }).handle(handler),
      );

      const body = { action: 'processOrder', orderId: '12345' };
      const record = snsRecord({ Sns: { TopicArn: topicArn, Message: JSON.stringify(body) } });
      const event = snsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body }));
    });

    test('handler receives raw string when message is not valid JSON', async ({ snsRecord, snsEvent, context }) => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { topicArn },
        }).handle(handler),
      );

      const record = snsRecord({ Sns: { TopicArn: topicArn, Message: 'not-json' } });
      const event = snsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: 'not-json' }));
    });
  });

  suite('convertMessageAttributes', () => {
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

  suite('full event processing', () => {
    test('routes an SNS event through multiple handlers and returns undefined', async ({
      snsRecord,
      snsEvent,
      context,
    }) => {
      const receivedCreateRequests: SNSRequest[] = [];
      const receivedDeleteRequests: SNSRequest[] = [];

      const orderRoute = defineRoute({
        filters: {
          messageAttributes: { eventType: 'order.created' },
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

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ snsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: SNSRequest, next: SNSNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createSNSRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = snsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ snsHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: SNSRequest, _next: SNSNext): Promise<void> {
        return;
      }

      const router = createSNSRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = snsHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ snsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: SNSRequest, next: SNSNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: SNSRequest, next: SNSNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createSNSRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = snsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ snsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: SNSRequest, next: SNSNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = snsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ snsHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: SNSRequest, _next: SNSNext): Promise<void> {
        return;
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = snsHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ snsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: SNSRequest, next: SNSNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: SNSRequest, next: SNSNext): Promise<void> {
        callOrder.push('route-mw2');
        await next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = snsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ snsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: SNSRequest, next: SNSNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });

      router.route(route);

      const { event, context } = snsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ snsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: SNSRequest, next: SNSNext): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: SNSRequest, next: SNSNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createSNSRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = snsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({ snsHandlerEvent }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: SNSRequest, _next: SNSNext): Promise<void> {
        return;
      }

      const router = createSNSRouter({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = snsHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async ({ snsHandlerEvent }) => {
      const middleware = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const router = createSNSRouter({ middleware: [middleware] });
      router.route({ filters: {}, bodySchema, handler: vi.fn() });

      const { event, context } = snsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('validation failed');
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});
