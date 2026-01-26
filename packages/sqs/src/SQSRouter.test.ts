import type { Schema } from '@lambda-event-router/base';
import { createSQSEvent, test } from '@lambda-event-router/testing';
import { createSQSRouter, defineRoute, SQSRouter } from './SQSRouter.js';
import type { SQSFilterInput, SQSMessageAttributes, SQSRequest } from './types.js';

describe('SQSRouter', () => {
  describe('createSQSRouter', () => {
    it('creates an SQSRouter instance', () => {
      const router = createSQSRouter();
      expect(router).toBeInstanceOf(SQSRouter);
    });
  });

  describe('canHandleEvent', () => {
    it('returns true for a valid SQS event', () => {
      const router = new SQSRouter();
      const event = createSQSEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    it('returns false for a non-SQS event', () => {
      const router = new SQSRouter();
      const event = { detail: { foo: 'bar' }, source: 'custom.app' };
      expect(router.canHandleEvent(event)).toBe(false);
    });
  });

  describe('route', () => {
    it('returns the router instance for chaining', () => {
      const router = new SQSRouter();
      const definition = defineRoute({
        filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  describe('handleEvent', () => {
    test('calls the matched handler with the parsed request', async ({ sqsHandlerEvent }) => {
      const router = new SQSRouter();
      const handler = vi.fn();
      const definition = defineRoute({
        filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
      }).handle(handler);
      router.route(definition);

      const { event, context } = sqsHandlerEvent();
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

  describe('handleEvent - matchRoute', () => {
    test('matches route by eventSourceArns', async ({ sqsHandlerEvent }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
        }).handle(handler),
      );

      const { event, context } = sqsHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalled();
    });

    test('does not match route when eventSourceArns does not match', async ({ sqsHandlerEvent }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:other-queue'] },
        }).handle(handler),
      );

      const { event, context } = sqsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
      expect(handler).not.toHaveBeenCalled();
    });

    test('matches route by messageAttributes', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.created'] } },
        }).handle(handler),
      );

      const event = sqsEvent([sqsRecord()]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalled();
    });

    test('does not match route when messageAttributes does not match', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { messageAttributes: { eventType: ['order.shipped'] } },
        }).handle(handler),
      );

      const event = sqsEvent([sqsRecord()]);
      await expect(router.handleEvent(event, context())).rejects.toThrow('No route matched');
      expect(handler).not.toHaveBeenCalled();
    });

    test('matches route by customFilter', async ({ sqsHandlerEvent }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ body }: SQSFilterInput): boolean => {
              const parsed = body as Record<string, unknown>;
              return parsed.action === 'processOrder';
            },
          },
        }).handle(handler),
      );

      const { event, context } = sqsHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalled();
    });

    test('does not match route when customFilter returns false', async ({ sqsHandlerEvent }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(handler),
      );

      const { event, context } = sqsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
      expect(handler).not.toHaveBeenCalled();
    });

    test('throws when no route matches', async ({ sqsHandlerEvent }) => {
      const router = createSQSRouter();

      const { event, context } = sqsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });
  });

  describe('defineRoute', () => {
    it('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });
  });

  describe('full event processing', () => {
    test('routes an SQS event through a handler and returns undefined when batchItemFailures is disabled', async ({
      sqsRecord,
      sqsEvent,
      context,
    }) => {
      const receivedCreateRequests: SQSRequest[] = [];
      const receivedDeleteRequests: SQSRequest[] = [];

      const router = createSQSRouter();
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

      const records = [
        sqsRecord({ messageAttributes: { eventType: { stringValue: 'order.created', dataType: 'string' } } }),
        sqsRecord({ messageAttributes: { eventType: { stringValue: 'order.created', dataType: 'string' } } }),
        sqsRecord({ messageAttributes: { eventType: { stringValue: 'order.deleted', dataType: 'string' } } }),
      ];
      const event = sqsEvent(records);
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

  describe('handleEvent - canHandleEvent', () => {
    it('returns false for null', () => {
      const router = new SQSRouter();

      expect(router.canHandleEvent(null)).toBe(false);
    });

    it('returns false for a string', () => {
      const router = new SQSRouter();

      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    it('returns false when Records is not an array', () => {
      const router = new SQSRouter();

      expect(router.canHandleEvent({ Records: 'not-an-array' })).toBe(false);
    });

    it('returns false when first record is not an object', () => {
      const router = new SQSRouter();

      expect(router.canHandleEvent({ Records: ['not-an-object'] })).toBe(false);
    });

    it('returns false when eventSource is not aws:sqs', () => {
      const router = new SQSRouter();

      expect(router.canHandleEvent({ Records: [{ eventSource: 'aws:sns' }] })).toBe(false);
    });
  });

  describe('handleEvent - parseJsonBody', () => {
    test('passes parsed JSON object to handler when body is valid JSON', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
        }).handle(handler),
      );

      const record = sqsRecord({ body: '{"greeting":"hello"}' });
      const event = sqsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { greeting: 'hello' },
        }),
      );
    });

    test('passes raw string to handler when body is not valid JSON', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
        }).handle(handler),
      );

      const record = sqsRecord({ body: 'plain text message' });
      const event = sqsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'plain text message',
        }),
      );
    });
  });

  describe('handleEvent - convertMessageAttributes', () => {
    test('converts String attribute to string value', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
        }).handle(handler),
      );

      const record = sqsRecord({
        messageAttributes: {
          myString: { stringValue: 'hello', stringListValues: [], binaryListValues: [], dataType: 'String' },
        },
      });
      const event = sqsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          messageAttributes: { myString: 'hello' },
        }),
      );
    });

    test('converts Number attribute to number value', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
        }).handle(handler),
      );

      const record = sqsRecord({
        messageAttributes: {
          myNumber: { stringValue: '42', stringListValues: [], binaryListValues: [], dataType: 'Number' },
        },
      });
      const event = sqsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          messageAttributes: { myNumber: 42 },
        }),
      );
    });

    test('converts Binary attribute to Buffer value', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
        }).handle(handler),
      );

      const binaryData = Buffer.from('binary-content').toString('base64');
      const record = sqsRecord({
        messageAttributes: {
          myBinary: { binaryValue: binaryData, stringListValues: [], binaryListValues: [], dataType: 'Binary' },
        },
      });
      const event = sqsEvent([record]);
      await router.handleEvent(event, context());

      const handlerCall = handler.mock.calls[0]?.[0] as SQSRequest;
      const binaryAttribute = handlerCall.messageAttributes.myBinary as Buffer;
      expect(Buffer.isBuffer(binaryAttribute)).toBe(true);
      expect(binaryAttribute.toString()).toBe('binary-content');
    });

    test('skips attributes with no stringValue or binaryValue', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
        }).handle(handler),
      );

      const record = sqsRecord({
        messageAttributes: {
          emptyAttr: { stringListValues: [], binaryListValues: [], dataType: 'String' },
          validAttr: { stringValue: 'present', stringListValues: [], binaryListValues: [], dataType: 'String' },
        },
      });
      const event = sqsEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          messageAttributes: { validAttr: 'present' },
        }),
      );
    });
  });

  describe('handleEvent - validateBody', () => {
    test('passes validated body to handler when bodySchema succeeds', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      const validatedData = { action: 'processOrder', orderId: '12345', validated: true };
      const bodySchema: Schema<typeof validatedData> = {
        safeParse: () => ({ success: true, data: validatedData }),
      };

      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
          bodySchema,
        }).handle(handler),
      );

      const event = sqsEvent([sqsRecord()]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: validatedData,
        }),
      );
    });

    test('throws when bodySchema validation fails', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      const bodySchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid body') }),
      };

      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
          bodySchema,
        }).handle(handler),
      );

      const record = sqsRecord();
      const event = sqsEvent([record]);

      await expect(router.handleEvent(event, context())).rejects.toThrow(
        `Body validation failed for record ${record.messageId}`,
      );
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent - validateMessageAttributes', () => {
    test('passes validated attributes to handler when messageAttributesSchema succeeds', async ({
      sqsRecord,
      sqsEvent,
      context,
    }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      const validatedAttributes = { eventType: 'order.created', extra: 'field' };
      const messageAttributesSchema: Schema<SQSMessageAttributes> = {
        safeParse: () => ({ success: true, data: validatedAttributes }),
      };

      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
          messageAttributesSchema,
        }).handle(handler),
      );

      const event = sqsEvent([sqsRecord()]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          messageAttributes: validatedAttributes,
        }),
      );
    });

    test('throws when messageAttributesSchema validation fails', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
      const handler = vi.fn();
      const messageAttributesSchema: Schema<SQSMessageAttributes> = {
        safeParse: () => ({ success: false, error: new Error('invalid attributes') }),
      };

      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
          messageAttributesSchema,
        }).handle(handler),
      );

      const record = sqsRecord();
      const event = sqsEvent([record]);

      await expect(router.handleEvent(event, context())).rejects.toThrow(
        `Message attributes validation failed for record ${record.messageId}`,
      );
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent - batchItemFailures (standard)', () => {
    test('returns undefined when all records succeed', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter({ batchItemFailures: true });
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
        }).handle(async () => {}),
      );

      const records = [sqsRecord(), sqsRecord(), sqsRecord()];
      const event = sqsEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
    });

    test('returns batchItemFailures with failed record messageIds when handler throws', async ({
      sqsRecord,
      sqsEvent,
      context,
    }) => {
      const router = createSQSRouter({ batchItemFailures: true });
      const failingRecord = sqsRecord();

      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
        }).handle(async (request) => {
          if (request.record.messageId === failingRecord.messageId) {
            throw new Error('processing failed');
          }
        }),
      );

      const records = [sqsRecord(), failingRecord, sqsRecord()];
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
      const router = createSQSRouter({ batchItemFailures: true });
      const failingRecordA = sqsRecord();
      const failingRecordB = sqsRecord();
      const succeedingRecord = sqsRecord();

      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789012:my-queue'] },
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

  describe('handleEvent - FIFO processing', () => {
    const fifoArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue.fifo';

    test('processes records sequentially within a message group', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter();
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
      const router = createSQSRouter();
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
      const router = createSQSRouter();
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

  describe('handleEvent - FIFO batchItemFailures', () => {
    const fifoArn = 'arn:aws:sqs:us-east-1:123456789012:my-queue.fifo';

    test('marks remaining records in group as failed when one fails', async ({ sqsRecord, sqsEvent, context }) => {
      const router = createSQSRouter({ batchItemFailures: true });

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
      const router = createSQSRouter({ batchItemFailures: true });

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
      const router = createSQSRouter({ batchItemFailures: true });

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
});
