import type { Schema } from '@lambda-event-router/base';
import { createSQSEvent, test } from '@lambda-event-router/testing';
import { createSQSRouter, defineRoute, SQSRouter } from './SQSRouter.js';
import type { SQSFilterInput, SQSMessageAttributes } from './types.js';

let router: SQSRouter;

beforeEach(() => {
  router = new SQSRouter();
});

suite('SQSRouter', () => {
  suite('createSQSRouter', () => {
    test('creates an SQSRouter instance', () => {
      const router = createSQSRouter();
      expect(router).toBeInstanceOf(SQSRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid SQS event', () => {
      const event = createSQSEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for a non-SQS event', () => {
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

    test('returns false when eventSource is not aws:sqs', () => {
      expect(router.canHandleEvent({ Records: [{ eventSource: 'aws:sns' }] })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, schemas, and handler in the definition', () => {
      const bodySchema: Schema<{ action: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { action: string } }),
      };
      const messageAttributesSchema: Schema<SQSMessageAttributes> = {
        safeParse: (data: unknown) => ({ success: true, data: data as SQSMessageAttributes }),
      };
      const handler = vi.fn();
      const filters = {
        eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'],
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
      const definition = defineRoute({
        filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches route by eventSourceArns', ({ sqsRecord }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
        }).handle(async () => {}),
      );

      const record = sqsRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, {});

      expect(result).toBeDefined();
    });

    test('does not match route when eventSourceArns does not match', ({ sqsRecord }) => {
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:other-queue'] },
        }).handle(async () => {}),
      );

      const record = sqsRecord({ eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:my-queue' });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, {});

      expect(result).toBeUndefined();
    });

    test('matches route by messageAttributes', ({ sqsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.created'] } },
        }).handle(async () => {}),
      );

      const record = sqsRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, { eventType: 'order.created' });

      expect(result).toBeDefined();
    });

    test('does not match route when messageAttributes does not match', ({ sqsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.shipped'] } },
        }).handle(async () => {}),
      );

      const record = sqsRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, { eventType: 'order.created' });

      expect(result).toBeUndefined();
    });

    test('matches route by number messageAttribute value', ({ sqsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { count: [42] } },
        }).handle(async () => {}),
      );

      const record = sqsRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, { count: 42 });

      expect(result).toBeDefined();
    });

    test('does not match when messageAttribute value is a Buffer', ({ sqsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { data: ['some-value'] } },
        }).handle(async () => {}),
      );

      const record = sqsRecord();
      const bufferValue = Buffer.from('some-value');
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, { data: bufferValue });

      expect(result).toBeUndefined();
    });

    test('matches when value is one of multiple allowed values', ({ sqsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.created', 'order.updated'] } },
        }).handle(async () => {}),
      );

      const record = sqsRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, { eventType: 'order.updated' });

      expect(result).toBeDefined();
    });

    test('requires all messageAttribute filter keys to match', ({ sqsRecord }) => {
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.created'], priority: ['high'] } },
        }).handle(async () => {}),
      );

      const record = sqsRecord();
      // @ts-expect-error - testing private method directly
      const matchingResult = router.matchRoute(record, {}, { eventType: 'order.created', priority: 'high' });
      expect(matchingResult).toBeDefined();

      // @ts-expect-error - testing private method directly
      const partialResult = router.matchRoute(record, {}, { eventType: 'order.created', priority: 'low' });
      expect(partialResult).toBeUndefined();
    });

    test('matches route when both eventSourceArns and messageAttributes match', ({ sqsRecord }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      router.route(
        defineRoute({
          filters: {
            eventSourceArns: [eventSourceArn],
            messageAttributes: { eventType: ['order.created'] },
          },
        }).handle(async () => {}),
      );

      const record = sqsRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, { eventType: 'order.created' });

      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArns matches but messageAttributes do not', ({ sqsRecord }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      router.route(
        defineRoute({
          filters: {
            eventSourceArns: [eventSourceArn],
            messageAttributes: { eventType: ['order.created'] },
          },
        }).handle(async () => {}),
      );

      const record = sqsRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, { eventType: 'order.shipped' });

      expect(result).toBeUndefined();
    });

    test('does not match when messageAttributes match but eventSourceArns does not', ({ sqsRecord }) => {
      router.route(
        defineRoute({
          filters: {
            eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:other-queue'],
            messageAttributes: { eventType: ['order.created'] },
          },
        }).handle(async () => {}),
      );

      const record = sqsRecord({ eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:my-queue' });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, { eventType: 'order.created' });

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', ({ sqsRecord }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ body }: SQSFilterInput): boolean => {
              // @ts-expect-error - body is unknown, testing filter with known shape
              return body.action === 'processOrder';
            },
          },
        }).handle(async () => {}),
      );

      const record = sqsRecord();
      const body = { action: 'processOrder' };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, body, {});

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', ({ sqsRecord }) => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const record = sqsRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, {});

      expect(result).toBeUndefined();
    });

    test('matches route with empty filters as a catch-all', ({ sqsRecord }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const record = sqsRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, {});

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', ({ sqsRecord }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.created'] } },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.created'] } },
        }).handle(secondHandler),
      );

      const record = sqsRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {}, { eventType: 'order.created' });

      expect(result).toBeDefined();
      // @ts-expect-error - result is asserted as defined above
      expect(result.handler).toBe(firstHandler);
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler with the parsed request', async ({ sqsRecord, sqsHandlerEvent }) => {
      const handler = vi.fn();
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';

      const definition = defineRoute({
        filters: { eventSourceArns: [eventSourceArn] },
      }).handle(handler);
      router.route(definition);

      const body = { action: 'processOrder', orderId: '12345' };
      const record = sqsRecord({
        eventSourceARN: eventSourceArn,
        body: JSON.stringify(body), // TODO: Fixture should stringify
        messageAttributes: {
          eventType: { stringValue: 'order.created', stringListValues: [], binaryListValues: [], dataType: 'String' },
        },
      });
      const { event, context } = sqsHandlerEvent({ records: [record] });
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

    test('throws when no route matches', async ({ sqsHandlerEvent }) => {
      const { event, context } = sqsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler error on standard queue when batchItemFailures is disabled', async ({
      sqsHandlerEvent,
    }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
        }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = sqsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('propagates handler error on FIFO queue when batchItemFailures is disabled', async ({
      sqsRecord,
      sqsEvent,
      context,
    }) => {
      const fifoArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue.fifo';

      router.route(
        defineRoute({
          filters: { eventSourceArns: [fifoArn] },
        }).handle(async () => {
          throw new Error('fifo handler exploded');
        }),
      );

      const record = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-1' },
      });
      const event = sqsEvent([record]);
      await expect(router.handleEvent(event, context())).rejects.toThrow('fifo handler exploded');
    });

    test('processes standard queue records in parallel', async ({ sqsRecord, sqsEvent, context }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      const callOrder: string[] = [];

      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
        }).handle(async (request) => {
          const messageId = request.record.messageId;
          callOrder.push(`start-${messageId}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${messageId}`);
        }),
      );

      const recordA = sqsRecord({ eventSourceARN: eventSourceArn });
      const recordB = sqsRecord({ eventSourceARN: eventSourceArn });
      const event = sqsEvent([recordA, recordB]);
      await router.handleEvent(event, context());

      // Parallel: both start before either finishes
      expect(callOrder[0]).toBe(`start-${recordA.messageId}`);
      expect(callOrder[1]).toBe(`start-${recordB.messageId}`);
    });
  });

  suite('handleEvent - batchItemFailures (standard)', () => {
    let router: SQSRouter;

    beforeEach(() => {
      router = new SQSRouter({ batchItemFailures: true });
    });

    test('returns batchItemFailure when no route matches and batchItemFailures is enabled', async ({
      sqsHandlerEvent,
    }) => {
      const { event, context } = sqsHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: event.Records[0]?.messageId }],
      });
    });

    test('returns undefined when all records succeed', async ({ sqsRecord, sqsEvent, context }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
        }).handle(async () => {}),
      );

      const records = [
        sqsRecord({ eventSourceARN: eventSourceArn }),
        sqsRecord({ eventSourceARN: eventSourceArn }),
        sqsRecord({ eventSourceARN: eventSourceArn }),
      ];
      const event = sqsEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
    });

    test('returns batchItemFailures with failed record messageIds when handler throws', async ({
      sqsRecord,
      sqsEvent,
      context,
    }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      const failingRecord = sqsRecord({ eventSourceARN: eventSourceArn });

      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
        }).handle(async (request) => {
          if (request.record.messageId === failingRecord.messageId) {
            throw new Error('processing failed');
          }
        }),
      );

      const records = [
        sqsRecord({ eventSourceARN: eventSourceArn }),
        failingRecord,
        sqsRecord({ eventSourceARN: eventSourceArn }),
      ];
      const event = sqsEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: failingRecord.messageId }],
      });
    });

    test('returns batchItemFailures only for the failing records, not all records', async ({
      sqsRecord,
      sqsEvent,
      context,
    }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      const failingRecordA = sqsRecord({ eventSourceARN: eventSourceArn });
      const failingRecordB = sqsRecord({ eventSourceARN: eventSourceArn });
      const succeedingRecord = sqsRecord({ eventSourceARN: eventSourceArn });

      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
        }).handle(async (request) => {
          const isFailingRecord =
            request.record.messageId === failingRecordA.messageId ||
            request.record.messageId === failingRecordB.messageId;
          if (isFailingRecord) {
            throw new Error('processing failed');
          }
        }),
      );

      const records = [failingRecordA, succeedingRecord, failingRecordB];
      const event = sqsEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: expect.arrayContaining([
          { itemIdentifier: failingRecordA.messageId },
          { itemIdentifier: failingRecordB.messageId },
        ]),
      });
      expect(result?.batchItemFailures).toHaveLength(2);
    });
  });

  suite('handleEvent - FIFO processing', () => {
    test('processes records sequentially within a message group', async ({ sqsRecord, sqsEvent, context }) => {
      const fifoArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue.fifo';
      const callOrder: string[] = [];

      router.route(
        defineRoute({
          filters: { eventSourceArns: [fifoArn] },
        }).handle(async (request) => {
          const messageId = request.record.messageId;
          callOrder.push(`start-${messageId}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${messageId}`);
        }),
      );

      const recordA = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-1' },
      });
      const recordB = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-1' },
      });

      const event = sqsEvent([recordA, recordB]);
      await router.handleEvent(event, context());

      // Sequential: first record must finish before second starts
      expect(callOrder).toEqual([
        `start-${recordA.messageId}`,
        `end-${recordA.messageId}`,
        `start-${recordB.messageId}`,
        `end-${recordB.messageId}`,
      ]);
    });

    test('processes multiple message groups in parallel', async ({ sqsRecord, sqsEvent, context }) => {
      const fifoArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue.fifo';
      const callOrder: string[] = [];

      router.route(
        defineRoute({
          filters: { eventSourceArns: [fifoArn] },
        }).handle(async (request) => {
          const groupId = request.record.attributes.MessageGroupId;
          callOrder.push(`start-${groupId}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${groupId}`);
        }),
      );

      const recordGroupA = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-A' },
      });
      const recordGroupB = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-B' },
      });

      const event = sqsEvent([recordGroupA, recordGroupB]);
      await router.handleEvent(event, context());

      // Parallel: both groups start before either finishes
      expect(callOrder[0]).toBe('start-group-A');
      expect(callOrder[1]).toBe('start-group-B');
    });

    test('groups records by MessageGroupId', async ({ sqsRecord, sqsEvent, context }) => {
      const fifoArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue.fifo';
      const groupARecords: string[] = [];
      const groupBRecords: string[] = [];

      router.route(
        defineRoute({
          filters: { eventSourceArns: [fifoArn] },
        }).handle(async (request) => {
          const groupId = request.record.attributes.MessageGroupId;
          if (groupId === 'group-A') {
            groupARecords.push(request.record.messageId);
          } else if (groupId === 'group-B') {
            groupBRecords.push(request.record.messageId);
          }
        }),
      );

      const recordA1 = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-A' },
      });
      const recordB1 = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-B' },
      });
      const recordA2 = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-A' },
      });

      const event = sqsEvent([recordA1, recordB1, recordA2]);
      await router.handleEvent(event, context());

      expect(groupARecords).toEqual([recordA1.messageId, recordA2.messageId]);
      expect(groupBRecords).toEqual([recordB1.messageId]);
    });
  });

  suite('handleEvent - FIFO batchItemFailures', () => {
    const fifoArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue.fifo';
    let router: SQSRouter;

    beforeEach(() => {
      router = new SQSRouter({ batchItemFailures: true });
    });

    test('marks remaining records in group as failed when one fails', async ({ sqsRecord, sqsEvent, context }) => {
      const record1 = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-1' },
      });
      const record2 = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-1' },
      });
      const record3 = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-1' },
      });
      const record4 = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-1' },
      });

      router.route(
        defineRoute({
          filters: { eventSourceArns: [fifoArn] },
        }).handle(async (request) => {
          if (request.record.messageId === record2.messageId) {
            throw new Error('processing failed');
          }
        }),
      );

      const event = sqsEvent([record1, record2, record3, record4]);
      const result = await router.handleEvent(event, context());

      // FIFO semantics: record2 fails, so records 2, 3, 4 are all failures
      expect(result).toEqual({
        batchItemFailures: [
          { itemIdentifier: record2.messageId },
          { itemIdentifier: record3.messageId },
          { itemIdentifier: record4.messageId },
        ],
      });
    });

    test('returns empty batchItemFailures when all records succeed', async ({ sqsRecord, sqsEvent, context }) => {
      router.route(
        defineRoute({
          filters: { eventSourceArns: [fifoArn] },
        }).handle(async () => {}),
      );

      const records = [
        sqsRecord({ eventSourceARN: fifoArn, attributes: { MessageGroupId: 'group-1' } }),
        sqsRecord({ eventSourceARN: fifoArn, attributes: { MessageGroupId: 'group-1' } }),
      ];
      const event = sqsEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
    });

    test('failures in one group do not affect other groups', async ({ sqsRecord, sqsEvent, context }) => {
      const groupARecord1 = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-A' },
      });
      const groupARecord2 = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-A' },
      });
      const groupBRecord1 = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-B' },
      });
      const groupBRecord2 = sqsRecord({
        eventSourceARN: fifoArn,
        attributes: { MessageGroupId: 'group-B' },
      });

      router.route(
        defineRoute({
          filters: { eventSourceArns: [fifoArn] },
        }).handle(async (request) => {
          // Fail the first record in group-A only
          if (request.record.messageId === groupARecord1.messageId) {
            throw new Error('group A failure');
          }
        }),
      );

      const event = sqsEvent([groupARecord1, groupARecord2, groupBRecord1, groupBRecord2]);
      const result = await router.handleEvent(event, context());

      // Group A: record1 fails, so record1 and record2 are failures
      // Group B: unaffected, all succeed
      const failedIds = result?.batchItemFailures.map((failure) => failure.itemIdentifier);
      expect(failedIds).toContain(groupARecord1.messageId);
      expect(failedIds).toContain(groupARecord2.messageId);
      expect(failedIds).not.toContain(groupBRecord1.messageId);
      expect(failedIds).not.toContain(groupBRecord2.messageId);
      expect(result?.batchItemFailures).toHaveLength(2);
    });
  });

  suite('handleEvent - schema validation', () => {
    test('handler receives validated body from bodySchema', async ({ sqsRecord, sqsEvent, context }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      const handler = vi.fn();
      const transformedBody = { action: 'processOrder', orderId: '12345', validated: true };
      const bodySchema: Schema<typeof transformedBody> = {
        safeParse: () => ({ success: true, data: transformedBody }),
      };

      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
          bodySchema,
        }).handle(handler),
      );

      const record = sqsRecord({
        eventSourceARN: eventSourceArn,
        body: JSON.stringify({ action: 'processOrder', orderId: '12345' }), // TODO: Fixture should stringify
      });
      const event = sqsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: transformedBody }));
    });

    test('throws when bodySchema validation fails and batchItemFailures is disabled', async ({
      sqsRecord,
      sqsEvent,
      context,
    }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      const bodySchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
          bodySchema,
        }).handle(async () => {}),
      );

      const record = sqsRecord({ eventSourceARN: eventSourceArn });
      const event = sqsEvent([record]);
      await expect(router.handleEvent(event, context())).rejects.toThrow('Body validation failed');
    });

    test('returns batchItemFailure when bodySchema validation fails', async ({ sqsRecord, sqsEvent, context }) => {
      const router = new SQSRouter({ batchItemFailures: true });
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      const bodySchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
          bodySchema,
        }).handle(async () => {}),
      );

      const record = sqsRecord({ eventSourceARN: eventSourceArn });
      const event = sqsEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: record.messageId }],
      });
    });

    test('handler receives validated attributes from messageAttributesSchema', async ({
      sqsRecord,
      sqsEvent,
      context,
    }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      const handler = vi.fn();
      const validatedAttributes = { eventType: 'order.created', extra: 'field' };
      const messageAttributesSchema: Schema<SQSMessageAttributes> = {
        safeParse: () => ({ success: true, data: validatedAttributes }),
      };
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
          messageAttributesSchema,
        }).handle(handler),
      );

      const record = sqsRecord({
        eventSourceARN: eventSourceArn,
        messageAttributes: {
          eventType: { stringValue: 'order.created', stringListValues: [], binaryListValues: [], dataType: 'String' },
        },
      });
      const event = sqsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ messageAttributes: validatedAttributes }));
    });

    test('throws when messageAttributesSchema validation fails and batchItemFailures is disabled', async ({
      sqsRecord,
      sqsEvent,
      context,
    }) => {
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      const messageAttributesSchema: Schema<SQSMessageAttributes> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
          messageAttributesSchema,
        }).handle(async () => {}),
      );

      const record = sqsRecord({
        eventSourceARN: eventSourceArn,
        messageAttributes: {
          eventType: { stringValue: 'order.created', stringListValues: [], binaryListValues: [], dataType: 'String' },
        },
      });
      const event = sqsEvent([record]);
      await expect(router.handleEvent(event, context())).rejects.toThrow('Message attributes validation failed');
    });

    test('returns batchItemFailure when messageAttributesSchema validation fails', async ({
      sqsRecord,
      sqsEvent,
      context,
    }) => {
      const router = new SQSRouter({ batchItemFailures: true });
      const eventSourceArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
      const messageAttributesSchema: Schema<SQSMessageAttributes> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
          messageAttributesSchema,
        }).handle(async () => {}),
      );

      const record = sqsRecord({
        eventSourceARN: eventSourceArn,
        messageAttributes: {
          eventType: { stringValue: 'order.created', stringListValues: [], binaryListValues: [], dataType: 'String' },
        },
      });
      const event = sqsEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: record.messageId }],
      });
    });
  });

  suite('parseJsonBody', () => {
    test('parses valid JSON body into an object', ({ sqsRecord }) => {
      const record = sqsRecord({ body: '{"greeting":"hello"}' });

      // @ts-expect-error - testing private method directly
      const result = router.parseJsonBody(record);

      expect(result).toEqual({ greeting: 'hello' });
    });

    test('returns raw string when body is not valid JSON', ({ sqsRecord }) => {
      const record = sqsRecord({ body: 'plain text message' });

      // @ts-expect-error - testing private method directly
      const result = router.parseJsonBody(record);

      expect(result).toBe('plain text message');
    });
  });

  suite('convertMessageAttributes', () => {
    test('converts String attribute to string value', () => {
      const raw = {
        myString: { stringValue: 'hello', stringListValues: [], binaryListValues: [], dataType: 'String' },
      };

      // @ts-expect-error - testing private method directly
      const result = router.convertMessageAttributes(raw);

      expect(result).toEqual({ myString: 'hello' });
    });

    test('converts Number attribute to number value', () => {
      const raw = {
        myNumber: { stringValue: '42', stringListValues: [], binaryListValues: [], dataType: 'Number' },
      };

      // @ts-expect-error - testing private method directly
      const result = router.convertMessageAttributes(raw);

      expect(result).toEqual({ myNumber: 42 });
    });

    test('converts Binary attribute to Buffer value', () => {
      const binaryData = Buffer.from('binary-content').toString('base64');
      const raw = {
        myBinary: { binaryValue: binaryData, stringListValues: [], binaryListValues: [], dataType: 'Binary' },
      };

      // @ts-expect-error - testing private method directly
      const result = router.convertMessageAttributes(raw);

      expect(Buffer.isBuffer(result.myBinary)).toBe(true);
      // @ts-expect-error - myBinary is a Buffer as asserted above
      expect(result.myBinary.toString()).toBe('binary-content');
    });
  });

  suite('validateBody', () => {
    test('returns validated data when bodySchema succeeds', ({ sqsRecord }) => {
      const record = sqsRecord();
      const body = { action: 'processOrder', orderId: '12345' };
      const validatedData = { ...body, validated: true };
      const schema: Schema<typeof validatedData> = {
        safeParse: () => ({ success: true, data: validatedData }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateBody(body, schema, record.messageId);

      expect(result).toEqual(validatedData);
    });

    test('throws when bodySchema validation fails', ({ sqsRecord }) => {
      const record = sqsRecord();
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid body') }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateBody({}, schema, record.messageId)).toThrow(
        `Body validation failed for record ${record.messageId}`,
      );
    });

    test('returns body unchanged when no schema is provided', ({ sqsRecord }) => {
      const record = sqsRecord();
      const body = { action: 'processOrder' };

      // @ts-expect-error - testing private method directly
      const result = router.validateBody(body, undefined, record.messageId);

      expect(result).toBe(body);
    });

    test('throws when body is a string and schema is provided', ({ sqsRecord }) => {
      const record = sqsRecord();
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('expected object, received string') }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateBody('not valid json', schema, record.messageId)).toThrow(
        `Body validation failed for record ${record.messageId}`,
      );
    });
  });

  suite('validateMessageAttributes', () => {
    test('returns validated attributes when messageAttributesSchema succeeds', ({ sqsRecord }) => {
      const record = sqsRecord();
      const messageAttributes = { eventType: 'order.created' };
      const validatedAttributes = { eventType: 'order.created', extra: 'field' };
      const schema: Schema<SQSMessageAttributes> = {
        safeParse: () => ({ success: true, data: validatedAttributes }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateMessageAttributes(messageAttributes, schema, record.messageId);

      expect(result).toEqual(validatedAttributes);
    });

    test('throws when messageAttributesSchema validation fails', ({ sqsRecord }) => {
      const record = sqsRecord();
      const schema: Schema<SQSMessageAttributes> = {
        safeParse: () => ({ success: false, error: new Error('invalid attributes') }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateMessageAttributes({}, schema, record.messageId)).toThrow(
        `Message attributes validation failed for record ${record.messageId}`,
      );
    });

    test('returns messageAttributes unchanged when no schema is provided', ({ sqsRecord }) => {
      const record = sqsRecord();
      const messageAttributes = { eventType: 'order.created' };

      // @ts-expect-error - testing private method directly
      const result = router.validateMessageAttributes(messageAttributes, undefined, record.messageId);

      expect(result).toBe(messageAttributes);
    });
  });

  suite('full event processing', () => {
    test('routes records to different handlers based on message attribute filters', async ({
      sqsRecord,
      sqsEvent,
      context,
    }) => {
      const createHandler = vi.fn();
      const deleteHandler = vi.fn();
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.created'] } },
        }).handle(createHandler),
      );
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.deleted'] } },
        }).handle(deleteHandler),
      );

      const records = [
        sqsRecord({
          messageAttributes: { eventType: { stringValue: 'order.created', dataType: 'String' } },
        }),
        sqsRecord({
          messageAttributes: { eventType: { stringValue: 'order.created', dataType: 'String' } },
        }),
        sqsRecord({
          messageAttributes: { eventType: { stringValue: 'order.deleted', dataType: 'String' } },
        }),
      ];
      const event = sqsEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
      expect(createHandler).toHaveBeenCalledTimes(2);
      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });
  });
});
