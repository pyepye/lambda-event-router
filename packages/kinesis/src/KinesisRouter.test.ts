import { createHash } from 'node:crypto';
import type { KinesisStreamRecord } from 'aws-lambda';

import { aggregate } from 'aws-kinesis-agg';
import type { MockInstance } from 'vitest';

import * as base from '@lambda-event-router/base';
import {
  allEventBuilders,
  createKinesisEvent,
  createKinesisRecord,
  createMockSchema,
  test,
} from '@lambda-event-router/testing';

import { createKinesisRouter, defineRoute, KinesisRouter } from './KinesisRouter.js';
import type { KinesisFilterInput, KinesisRequest } from './types.js';

type KinesisNext = (request: KinesisRequest) => Promise<void>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');
const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');

let router: KinesisRouter;

interface UserRecordInput {
  partitionKey: string;
  data: string;
}

function aggregateUserRecords(userRecords: UserRecordInput[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    aggregate(
      userRecords,
      (encodedRecord, done) => {
        resolve(encodedRecord.data);
        done();
      },
      () => {},
      reject,
    );
  });
}

async function createAggregatedRecord(userRecords: UserRecordInput[]): Promise<KinesisStreamRecord> {
  const aggregatedData = await aggregateUserRecords(userRecords);
  const record = createKinesisRecord({ kinesis: { partitionKey: 'outer-key' } });
  record.kinesis.data = aggregatedData.toString('base64');
  return record;
}

const orderUserRecords: UserRecordInput[] = [
  { partitionKey: 'order-1', data: JSON.stringify({ orderId: '1' }) },
  { partitionKey: 'order-2', data: JSON.stringify({ orderId: '2' }) },
  { partitionKey: 'order-1', data: JSON.stringify({ orderId: '3' }) },
];

beforeEach(() => {
  router = new KinesisRouter();
});

suite('KinesisRouter', () => {
  suite('createKinesisRouter', () => {
    test('creates a KinesisRouter instance', () => {
      const router = createKinesisRouter();
      expect(router).toBeInstanceOf(KinesisRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid Kinesis event', () => {
      const event = createKinesisEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for a non-Kinesis event', () => {
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

    test('returns false when eventSource is not aws:kinesis', () => {
      expect(router.canHandleEvent({ Records: [{ eventSource: 'aws:sqs' }] })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, dataSchema, and handler in the definition', () => {
      const dataSchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream',
        partitionKey: 'partition-key-1',
      };

      const definition = defineRoute({
        filters,
        dataSchema,
      }).handle(handler);

      expect(definition.filters).toEqual(filters);
      expect(definition.dataSchema).toBe(dataSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream' },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches route by eventSourceArn', async ({ kinesisRecord }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeDefined();
    });

    test('orders a narrower route ahead of a broader one registered first', async ({ kinesisRecord }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const broad = vi.fn();
      const narrow = vi.fn();
      router.route(
        defineRoute({ filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789012:*' } }).handle(broad),
      );
      router.route(defineRoute({ filters: { eventSourceArn } }).handle(narrow));

      const record = kinesisRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result?.handler).toBe(narrow);
    });

    test('orders a guarded route ahead of the fallback it shares filters with', async ({ kinesisRecord }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const fallback = vi.fn();
      const guarded = vi.fn();
      router.route(defineRoute({ filters: { eventSourceArn } }).handle(fallback));
      router.route(defineRoute({ filters: { eventSourceArn, custom: () => true } }).handle(guarded));

      const record = kinesisRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result?.handler).toBe(guarded);
    });

    test('does not match when eventSourceArn is an empty string', async ({ kinesisRecord }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      router.route(
        defineRoute({
          filters: { eventSourceArn: '' },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeUndefined();
    });

    test('matches route by eventSourceArn array', async ({ kinesisRecord }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const eventSourceArn2 = 'arn:aws:kinesis:eu-west-2:987654321098:stream/other-stream';
      router.route(
        defineRoute({
          filters: { eventSourceArn: [eventSourceArn, eventSourceArn2] },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArn does not match', async ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789012:stream/other-stream' },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ eventSourceARN: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream' });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeUndefined();
    });

    test('matches route by partitionKey', async ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: { partitionKey: 'partition-key-1' },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ kinesis: { partitionKey: 'partition-key-1' } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeDefined();
    });

    test('matches route by partitionKey array', async ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: { partitionKey: ['partition-key-1', 'partition-key-2'] },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ kinesis: { partitionKey: 'partition-key-1' } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeDefined();
    });

    test('does not match when partitionKey does not match', async ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: { partitionKey: 'partition-key-2' },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ kinesis: { partitionKey: 'partition-key-1' } });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeUndefined();
    });

    test('matches route by custom', async ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: {
            custom: ({ data }: KinesisFilterInput): boolean => {
              // @ts-expect-error - data is unknown, testing filter with known shape
              return data.action === 'processOrder';
            },
          },
        }).handle(async () => {}),
      );

      const record = kinesisRecord();
      const data = { action: 'processOrder' };
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, data);

      expect(result).toBeDefined();
    });

    test('does not match when custom returns false', async ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: { custom: (): boolean => false },
        }).handle(async () => {}),
      );

      const record = kinesisRecord();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeUndefined();
    });

    test('matches route by async custom', async ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: {
            custom: async ({ data }: KinesisFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              // @ts-expect-error - data is unknown, testing filter with known shape
              return data.action === 'processOrder';
            },
          },
        }).handle(async () => {}),
      );

      const record = kinesisRecord();
      const data = { action: 'processOrder' };
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, data);

      expect(result).toBeDefined();
    });

    test('matches with empty filters as catch-all', async ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const record = kinesisRecord();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeDefined();
    });

    test('selects first matching route when multiple match', async ({ kinesisRecord }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream' },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream' },
        }).handle(secondHandler),
      );

      const record = kinesisRecord({
        eventSourceARN: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream',
      });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('matches when both eventSourceArn and partitionKey match', async ({ kinesisRecord }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      router.route(
        defineRoute({
          filters: {
            eventSourceArn: eventSourceArn,
            partitionKey: 'partition-key-1',
          },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({
        eventSourceARN: eventSourceArn,
        kinesis: { partitionKey: 'partition-key-1' },
      });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArn matches but partitionKey does not', async ({ kinesisRecord }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      router.route(
        defineRoute({
          filters: {
            eventSourceArn: eventSourceArn,
            partitionKey: 'partition-key-2',
          },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({
        eventSourceARN: eventSourceArn,
        kinesis: { partitionKey: 'partition-key-1' },
      });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeUndefined();
    });

    test('does not match when partitionKey matches but eventSourceArn does not', async ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: {
            eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789012:stream/other-stream',
            partitionKey: 'partition-key-1',
          },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({
        eventSourceARN: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream',
        kinesis: { partitionKey: 'partition-key-1' },
      });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, record.kinesis.partitionKey, {});

      expect(result).toBeUndefined();
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler with the parsed request', async ({ kinesisRecord, kinesisHandlerEvent }) => {
      const handler = vi.fn();
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';

      const definition = defineRoute({
        filters: { eventSourceArn: eventSourceArn },
      }).handle(handler);
      router.route(definition);

      const body = { action: 'processOrder', orderId: '12345' }; // This gets auto encoded by kinesisRecord
      const record = kinesisRecord({
        eventSourceARN: eventSourceArn,
        kinesis: {
          data: body,
          partitionKey: 'partition-key-1',
          sequenceNumber: 'seq-123',
          approximateArrivalTimestamp: 1704067200,
        },
      });
      const { event, context } = kinesisHandlerEvent({ records: [record] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: body,
          partitionKey: 'partition-key-1',
          sequenceNumber: 'seq-123',
          approximateArrivalTimestamp: 1704067200,
          record: event.Records[0],
          context,
        }),
      );
    });

    test('throws when no route matches', async ({ kinesisHandlerEvent }) => {
      const { event, context } = kinesisHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler error', async ({ kinesisHandlerEvent }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
        }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = kinesisHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('processes records sequentially', async ({ kinesisRecord, kinesisEvent, context }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const callOrder: string[] = [];

      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
        }).handle(async (request) => {
          const eventId = request.record.eventID;
          callOrder.push(`start-${eventId}`);
          await new Promise((resolve) => setTimeout(resolve, 1));
          callOrder.push(`end-${eventId}`);
        }),
      );

      const recordA = kinesisRecord({ eventSourceARN: eventSourceArn });
      const recordB = kinesisRecord({ eventSourceARN: eventSourceArn });
      const event = kinesisEvent([recordA, recordB]);
      await router.handleEvent(event, context());

      // Sequential: first record must finish before second starts
      expect(callOrder).toEqual([
        `start-${recordA.eventID}`,
        `end-${recordA.eventID}`,
        `start-${recordB.eventID}`,
        `end-${recordB.eventID}`,
      ]);
    });

    test('returns undefined on success', async ({ kinesisHandlerEvent }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const { event, context } = kinesisHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });
  });

  suite('handleEvent - batchItemFailures', () => {
    let router: KinesisRouter;

    beforeEach(() => {
      router = new KinesisRouter({ batchItemFailures: true });
    });

    test('returns batchItemFailure when no route matches', async ({ kinesisHandlerEvent }) => {
      const { event, context } = kinesisHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: event.Records[0]?.kinesis.sequenceNumber }],
      });
    });

    test('returns undefined when all records succeed', async ({ kinesisRecord, kinesisEvent, context }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
        }).handle(async () => {}),
      );

      const records = [
        kinesisRecord({ eventSourceARN: eventSourceArn }),
        kinesisRecord({ eventSourceARN: eventSourceArn }),
        kinesisRecord({ eventSourceARN: eventSourceArn }),
      ];
      const event = kinesisEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
    });

    test('returns batchItemFailures for failed record and all remaining records', async ({
      kinesisRecord,
      kinesisEvent,
      context,
    }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const handler = vi.fn();

      const record1 = kinesisRecord({ eventSourceARN: eventSourceArn });
      const record2 = kinesisRecord({ eventSourceARN: eventSourceArn });
      const record3 = kinesisRecord({ eventSourceARN: eventSourceArn });
      const record4 = kinesisRecord({ eventSourceARN: eventSourceArn });

      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
        }).handle(async (request) => {
          handler(request.record.eventID);
          if (request.record.eventID === record2.eventID) {
            throw new Error('processing failed');
          }
        }),
      );

      const event = kinesisEvent([record1, record2, record3, record4]);
      const result = await router.handleEvent(event, context());

      // record1 succeeds, record2 fails, record3 and record4 are marked as failures
      expect(handler).toHaveBeenCalledWith(record1.eventID);
      expect(handler).toHaveBeenCalledWith(record2.eventID);
      expect(handler).not.toHaveBeenCalledWith(record3.eventID);
      expect(handler).not.toHaveBeenCalledWith(record4.eventID);
      expect(result).toEqual({
        batchItemFailures: [
          { itemIdentifier: record2.kinesis.sequenceNumber },
          { itemIdentifier: record3.kinesis.sequenceNumber },
          { itemIdentifier: record4.kinesis.sequenceNumber },
        ],
      });
    });
  });

  suite('handleEvent - schema validation', () => {
    test('handler receives validated data from dataSchema', async ({ kinesisRecord, kinesisEvent, context }) => {
      const handler = vi.fn();
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const dataSchema = createMockSchema();

      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
          dataSchema,
        }).handle(handler),
      );

      const body = { action: 'processOrder', orderId: '12345' };
      const record = kinesisRecord({
        eventSourceARN: eventSourceArn,
        kinesis: { data: body },
      });
      const event = kinesisEvent([record]);
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith(body, dataSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: body }));
    });

    test('throws when dataSchema fails and batchItemFailures disabled', async ({
      kinesisRecord,
      kinesisEvent,
      context,
    }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const dataSchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
          dataSchema,
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ eventSourceARN: eventSourceArn });
      const event = kinesisEvent([record]);
      await expect(router.handleEvent(event, context())).rejects.toThrow('Data validation failed');
    });

    test('returns batchItemFailure when dataSchema fails and batchItemFailures enabled', async ({
      kinesisRecord,
      kinesisEvent,
      context,
    }) => {
      const router = new KinesisRouter({ batchItemFailures: true });
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const dataSchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
          dataSchema,
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ eventSourceARN: eventSourceArn });
      const event = kinesisEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: record.kinesis.sequenceNumber }],
      });
    });
  });

  suite('handleEvent - jsonParse', () => {
    test('passes decoded kinesis data to safeJsonParse', async ({ kinesisRecord, kinesisEvent, context }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
        }).handle(handler),
      );

      const body = { action: 'processOrder', orderId: '12345' };
      const record = kinesisRecord({ eventSourceARN: eventSourceArn, kinesis: { data: body } });
      const event = kinesisEvent([record]);
      await router.handleEvent(event, context());

      expect(safeJsonParseSpy).toHaveBeenCalledWith(JSON.stringify(body));
    });

    test('handler receives parsed object when data is valid JSON', async ({ kinesisRecord, kinesisEvent, context }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
        }).handle(handler),
      );

      const body = { action: 'processOrder', orderId: '12345' };
      const record = kinesisRecord({ eventSourceARN: eventSourceArn, kinesis: { data: body } });
      const event = kinesisEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: body }));
    });

    test('handler receives raw string when data is not valid JSON', async ({
      kinesisRecord,
      kinesisEvent,
      context,
    }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
        }).handle(handler),
      );

      const record = kinesisRecord({ eventSourceARN: eventSourceArn, kinesis: { data: 'not-json' } });
      const event = kinesisEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: 'not-json' }));
    });
  });

  suite('handleEvent - rawData', () => {
    test('hands the handler the record bytes as rawData', async ({ kinesisRecord, kinesisHandlerEvent }) => {
      const handler = vi.fn();
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      router.route(defineRoute({ filters: { eventSourceArn } }).handle(handler));

      const gzipBytes = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xfe]);
      const record = kinesisRecord({ eventSourceARN: eventSourceArn });
      record.kinesis.data = gzipBytes.toString('base64');
      const { event, context } = kinesisHandlerEvent({ records: [record] });

      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ rawData: gzipBytes }));
    });

    test('passes rawData to a custom filter', async ({ kinesisRecord, kinesisHandlerEvent }) => {
      const custom = vi.fn().mockReturnValue(true);
      router.route(defineRoute({ filters: { custom } }).handle(async () => {}));

      const gzipBytes = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xfe]);
      const record = kinesisRecord();
      record.kinesis.data = gzipBytes.toString('base64');
      const { event, context } = kinesisHandlerEvent({ records: [record] });

      await router.handleEvent(event, context);

      expect(custom).toHaveBeenCalledWith(expect.objectContaining({ rawData: gzipBytes }));
    });
  });

  suite('handleEvent - aggregated records', () => {
    test('routes each record inside an aggregate on its own', async ({ context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const record = await createAggregatedRecord(orderUserRecords);
      await router.handleEvent(createKinesisEvent([record]), context());

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: { orderId: '1' } }));
      expect(handler).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { orderId: '2' } }));
      expect(handler).toHaveBeenNthCalledWith(3, expect.objectContaining({ data: { orderId: '3' } }));
    });

    test('hands the handler the inner record bytes as rawData', async ({ context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const record = await createAggregatedRecord(orderUserRecords);
      await router.handleEvent(createKinesisEvent([record]), context());

      expect(handler).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ rawData: Buffer.from(JSON.stringify({ orderId: '2' })) }),
      );
    });

    test('gives each inner record its own partition key', async ({ context }) => {
      const handler = vi.fn<(request: KinesisRequest) => Promise<void>>();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const record = await createAggregatedRecord(orderUserRecords);
      await router.handleEvent(createKinesisEvent([record]), context());

      const partitionKeys = handler.mock.calls.map(([request]) => request.partitionKey);
      expect(partitionKeys).toEqual(['order-1', 'order-2', 'order-1']);
    });

    test('matches the partitionKey filter against the inner partition key', async ({ context }) => {
      const orderOneHandler = vi.fn();
      const otherHandler = vi.fn();
      router.route(defineRoute({ filters: { partitionKey: 'order-1' } }).handle(orderOneHandler));
      router.route(defineRoute({ filters: {} }).handle(otherHandler));

      const record = await createAggregatedRecord(orderUserRecords);
      await router.handleEvent(createKinesisEvent([record]), context());

      expect(orderOneHandler).toHaveBeenCalledTimes(2);
      expect(otherHandler).toHaveBeenCalledTimes(1);
    });

    test('passes the inner data and partition key to a custom filter', async ({ context }) => {
      const custom = vi.fn().mockReturnValue(true);
      router.route(defineRoute({ filters: { custom } }).handle(async () => {}));

      const record = await createAggregatedRecord(orderUserRecords);
      await router.handleEvent(createKinesisEvent([record]), context());

      expect(custom).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ data: { orderId: '2' }, partitionKey: 'order-2' }),
      );
    });

    test('sets subSequenceNumber to the position inside the aggregate', async ({ context }) => {
      const handler = vi.fn<(request: KinesisRequest) => Promise<void>>();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const record = await createAggregatedRecord(orderUserRecords);
      await router.handleEvent(createKinesisEvent([record]), context());

      const subSequenceNumbers = handler.mock.calls.map(([request]) => request.subSequenceNumber);
      expect(subSequenceNumbers).toEqual([0, 1, 2]);
    });

    test('gives every inner record the sequence number and record of the aggregate', async ({ context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const record = await createAggregatedRecord(orderUserRecords);
      await router.handleEvent(createKinesisEvent([record]), context());

      expect(handler).toHaveBeenCalledTimes(3);
      for (const [request] of handler.mock.calls) {
        expect(request).toEqual(expect.objectContaining({ sequenceNumber: record.kinesis.sequenceNumber, record }));
      }
    });

    test('leaves subSequenceNumber undefined for a plain record', async ({ kinesisHandlerEvent }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const { event, context } = kinesisHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ subSequenceNumber: undefined }));
    });

    test('validates each inner record against dataSchema', async ({ context }) => {
      const dataSchema = createMockSchema();
      router.route(defineRoute({ filters: {}, dataSchema }).handle(async () => {}));

      const record = await createAggregatedRecord(orderUserRecords);
      await router.handleEvent(createKinesisEvent([record]), context());

      expect(validateSchemaSpy).toHaveBeenCalledWith({ orderId: '1' }, dataSchema, expect.any(String));
      expect(validateSchemaSpy).toHaveBeenCalledWith({ orderId: '2' }, dataSchema, expect.any(String));
      expect(validateSchemaSpy).toHaveBeenCalledWith({ orderId: '3' }, dataSchema, expect.any(String));
    });

    test('routes a record with a checksum that does not match as a plain record', async ({ context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const aggregatedData = await aggregateUserRecords(orderUserRecords);
      const lastByteIndex = aggregatedData.length - 1;
      aggregatedData[lastByteIndex] = (aggregatedData[lastByteIndex] ?? 0) ^ 0xff;
      const record = createKinesisRecord();
      record.kinesis.data = aggregatedData.toString('base64');
      await router.handleEvent(createKinesisEvent([record]), context());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ rawData: aggregatedData, partitionKey: record.kinesis.partitionKey }),
      );
    });

    test('routes a record holding only the magic bytes as a plain record', async ({ context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const magicOnly = Buffer.from([0xf3, 0x89, 0x9a, 0xc2]);
      const record = createKinesisRecord();
      record.kinesis.data = magicOnly.toString('base64');
      await router.handleEvent(createKinesisEvent([record]), context());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ rawData: magicOnly }));
    });

    test('routes a record with a valid checksum over bytes that are not an aggregate as a plain record', async ({
      context,
    }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const magic = Buffer.from([0xf3, 0x89, 0x9a, 0xc2]);
      // Field 3 claims 100 bytes of length-delimited data but only 2 follow
      const truncatedMessage = Buffer.from([0x1a, 0x64, 0x01, 0x02]);
      const checksum = createHash('md5').update(truncatedMessage).digest();
      const rawData = Buffer.concat([magic, truncatedMessage, checksum]);
      const record = createKinesisRecord();
      record.kinesis.data = rawData.toString('base64');
      await router.handleEvent(createKinesisEvent([record]), context());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ rawData }));
    });

    test('throws when an inner record fails and batchItemFailures is disabled', async ({ context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: { partitionKey: 'order-1' } }).handle(handler));

      const record = await createAggregatedRecord(orderUserRecords);

      await expect(router.handleEvent(createKinesisEvent([record]), context())).rejects.toThrow('No route matched');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('reports the aggregate once and stops at the first inner record that fails', async ({ context }) => {
      const router = new KinesisRouter({ batchItemFailures: true });
      const handler = vi.fn(async (request: KinesisRequest) => {
        if (request.subSequenceNumber === 1) throw new Error('processing failed');
      });
      router.route(defineRoute({ filters: {} }).handle(handler));

      const aggregatedRecord = await createAggregatedRecord(orderUserRecords);
      const laterRecord = createKinesisRecord();
      const result = await router.handleEvent(createKinesisEvent([aggregatedRecord, laterRecord]), context());

      expect(handler).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        batchItemFailures: [
          { itemIdentifier: aggregatedRecord.kinesis.sequenceNumber },
          { itemIdentifier: laterRecord.kinesis.sequenceNumber },
        ],
      });
    });
  });

  suite('full event processing', () => {
    test('routes records to different handlers based on filters', async ({ kinesisRecord, kinesisEvent, context }) => {
      const streamAHandler = vi.fn();
      const streamBHandler = vi.fn();

      const streamAArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/stream-a';
      const streamBArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/stream-b';

      router.route(
        defineRoute({
          filters: { eventSourceArn: streamAArn },
        }).handle(streamAHandler),
      );
      router.route(
        defineRoute({
          filters: { eventSourceArn: streamBArn },
        }).handle(streamBHandler),
      );

      const records = [
        kinesisRecord({ eventSourceARN: streamAArn }),
        kinesisRecord({ eventSourceARN: streamAArn }),
        kinesisRecord({ eventSourceARN: streamBArn }),
      ];
      const event = kinesisEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
      expect(streamAHandler).toHaveBeenCalledTimes(2);
      expect(streamBHandler).toHaveBeenCalledTimes(1);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ kinesisHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: KinesisRequest, next: KinesisNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createKinesisRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = kinesisHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('executes middleware per-record for multi-record events', async ({ kinesisRecord, kinesisEvent, context }) => {
      const recordIds: string[] = [];

      async function middleware(request: KinesisRequest, next: KinesisNext): Promise<void> {
        recordIds.push(request.record.eventID);
        await next(request);
      }

      const router = createKinesisRouter({ middleware: [middleware] });
      router.route({ filters: {}, handler: async () => {} });

      const event = kinesisEvent([kinesisRecord({ eventID: 'evt-1' }), kinesisRecord({ eventID: 'evt-2' })]);
      await router.handleEvent(event, context());

      expect(recordIds).toEqual(['evt-1', 'evt-2']);
    });

    test('allows middleware to skip a record by not calling next', async ({ kinesisHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: KinesisRequest, _next: KinesisNext): Promise<void> {
        return;
      }

      const router = createKinesisRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = kinesisHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ kinesisHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: KinesisRequest, next: KinesisNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: KinesisRequest, next: KinesisNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createKinesisRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = kinesisHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ kinesisHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: KinesisRequest, next: KinesisNext): Promise<void> {
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

      const { event, context } = kinesisHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ kinesisHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: KinesisRequest, _next: KinesisNext): Promise<void> {
        return;
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = kinesisHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ kinesisHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: KinesisRequest, next: KinesisNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: KinesisRequest, next: KinesisNext): Promise<void> {
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

      const { event, context } = kinesisHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ kinesisHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: KinesisRequest, next: KinesisNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });

      router.route(route);

      const { event, context } = kinesisHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ kinesisHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: KinesisRequest, next: KinesisNext): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: KinesisRequest, next: KinesisNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createKinesisRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = kinesisHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({ kinesisHandlerEvent }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: KinesisRequest, _next: KinesisNext): Promise<void> {
        return;
      }

      const router = createKinesisRouter({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = kinesisHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async ({ kinesisHandlerEvent }) => {
      const middleware = vi.fn();
      const dataSchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const router = createKinesisRouter({ middleware: [middleware] });
      router.route({ filters: {}, dataSchema, handler: vi.fn() });

      const { event, context } = kinesisHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('validation failed');
      expect(middleware).not.toHaveBeenCalled();
    });
  });

  suite('batch item failures with middleware', () => {
    test('middleware errors are tracked as batch item failures', async ({ kinesisRecord, kinesisEvent, context }) => {
      const handler = vi.fn();

      async function failingMiddleware(_request: KinesisRequest, _next: KinesisNext): Promise<void> {
        throw new Error('middleware error');
      }

      const router = createKinesisRouter({ batchItemFailures: true, middleware: [failingMiddleware] });
      router.route({ filters: {}, handler });

      const record = kinesisRecord({ kinesis: { sequenceNumber: 'seq-1' } });
      const event = kinesisEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'seq-1' }] });
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

suite('KinesisRouter.canHandleEvent', () => {
  const ownEvents = ['createKinesisEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createKinesisRouter().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
