import * as base from '@lambda-event-router/base';
import { createFirehoseEvent, createMockSchema, test } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
import { createFirehoseRouter, defineRoute, FirehoseRouter } from './FirehoseRouter.js';
import type { FirehoseResponseResult } from './response.js';
import { Dropped, Failed, Ok } from './response.js';
import type { FirehoseFilterInput, FirehoseRequest } from './types.js';

type FirehoseNext = (request: FirehoseRequest) => Promise<FirehoseResponseResult>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');
const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');

suite('FirehoseRouter', () => {
  let router: FirehoseRouter;

  beforeEach(() => {
    router = new FirehoseRouter();
  });

  suite('createFirehoseRouter', () => {
    test('creates a FirehoseRouter instance', () => {
      const router = createFirehoseRouter();
      expect(router).toBeInstanceOf(FirehoseRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid Firehose event', () => {
      const event = createFirehoseEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when deliveryStreamArn is not a string', () => {
      expect(router.canHandleEvent({ deliveryStreamArn: 123, records: [{ recordId: 'abc' }] })).toBe(false);
    });

    test('returns false when records is not an array', () => {
      expect(router.canHandleEvent({ deliveryStreamArn: 'arn:aws:firehose:...', records: 'not-an-array' })).toBe(false);
    });

    test('returns false when first record is not an object', () => {
      expect(router.canHandleEvent({ deliveryStreamArn: 'arn:aws:firehose:...', records: ['not-an-object'] })).toBe(
        false,
      );
    });

    test('returns false when first record has no string recordId', () => {
      expect(router.canHandleEvent({ deliveryStreamArn: 'arn:aws:firehose:...', records: [{ recordId: 123 }] })).toBe(
        false,
      );
    });

    test('returns false when records array is empty', () => {
      expect(router.canHandleEvent({ deliveryStreamArn: 'arn:aws:firehose:...', records: [] })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { deliveryStreamArns: ['arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(builder.handle).toBeTypeOf('function');
    });

    test('preserves filters, dataSchema, and handler in the definition', () => {
      const dataSchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        deliveryStreamArns: ['arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream'],
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
        filters: { deliveryStreamArns: ['arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream'] },
      }).handle(async () => Ok());

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches by deliveryStreamArns', ({ firehoseRecord }) => {
      const deliveryStreamArn = 'arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream';
      router.route(
        defineRoute({
          filters: { deliveryStreamArns: [deliveryStreamArn] },
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record], { deliveryStreamArn });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, {});

      expect(result).toBeDefined();
    });

    test('does not match when deliveryStreamArns does not match', ({ firehoseRecord }) => {
      router.route(
        defineRoute({
          filters: { deliveryStreamArns: ['arn:aws:firehose:us-east-1:123456789012:deliverystream/other-stream'] },
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record], {
        deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream',
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, {});

      expect(result).toBeUndefined();
    });

    test('matches by sourceKinesisStreamArns', ({ firehoseRecord }) => {
      const sourceKinesisStreamArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-kinesis-stream';
      router.route(
        defineRoute({
          filters: { sourceKinesisStreamArns: [sourceKinesisStreamArn] },
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record], { sourceKinesisStreamArn });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, {});

      expect(result).toBeDefined();
    });

    test('does not match when sourceKinesisStreamArns does not match', ({ firehoseRecord }) => {
      router.route(
        defineRoute({
          filters: { sourceKinesisStreamArns: ['arn:aws:kinesis:us-east-1:123456789012:stream/other-stream'] },
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record], {
        sourceKinesisStreamArn: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-kinesis-stream',
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, {});

      expect(result).toBeUndefined();
    });

    test('does not match when sourceKinesisStreamArns filter set but event has no sourceKinesisStreamArn', ({
      firehoseRecord,
    }) => {
      router.route(
        defineRoute({
          filters: { sourceKinesisStreamArns: ['arn:aws:kinesis:us-east-1:123456789012:stream/my-kinesis-stream'] },
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record]);
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, {});

      expect(result).toBeUndefined();
    });

    test('matches by customFilter', ({ firehoseRecord }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ data }: FirehoseFilterInput): boolean => {
              // @ts-expect-error - data is unknown, testing filter with known shape
              return data.action === 'processOrder';
            },
          },
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record]);
      const data = { action: 'processOrder' };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, data);

      expect(result).toBeDefined();
    });

    test('does not match when customFilter returns false', ({ firehoseRecord }) => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record]);
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, {});

      expect(result).toBeUndefined();
    });

    test('matches with empty filters as catch-all', ({ firehoseRecord }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record]);
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, {});

      expect(result).toBeDefined();
    });

    test('selects first matching route when multiple match', ({ firehoseRecord }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      const deliveryStreamArn = 'arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream';

      router.route(
        defineRoute({
          filters: { deliveryStreamArns: [deliveryStreamArn] },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { deliveryStreamArns: [deliveryStreamArn] },
        }).handle(secondHandler),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record], { deliveryStreamArn });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, {});

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('matches when both deliveryStreamArns and sourceKinesisStreamArns match', ({ firehoseRecord }) => {
      const deliveryStreamArn = 'arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream';
      const sourceKinesisStreamArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-kinesis-stream';
      router.route(
        defineRoute({
          filters: {
            deliveryStreamArns: [deliveryStreamArn],
            sourceKinesisStreamArns: [sourceKinesisStreamArn],
          },
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record], { deliveryStreamArn, sourceKinesisStreamArn });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, {});

      expect(result).toBeDefined();
    });

    test('does not match when deliveryStreamArns matches but sourceKinesisStreamArns does not', ({
      firehoseRecord,
    }) => {
      const deliveryStreamArn = 'arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream';
      router.route(
        defineRoute({
          filters: {
            deliveryStreamArns: [deliveryStreamArn],
            sourceKinesisStreamArns: ['arn:aws:kinesis:us-east-1:123456789012:stream/other-stream'],
          },
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record], {
        deliveryStreamArn,
        sourceKinesisStreamArn: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-kinesis-stream',
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, {});

      expect(result).toBeUndefined();
    });

    test('does not match when sourceKinesisStreamArns matches but deliveryStreamArns does not', ({
      firehoseRecord,
    }) => {
      const sourceKinesisStreamArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-kinesis-stream';
      router.route(
        defineRoute({
          filters: {
            deliveryStreamArns: ['arn:aws:firehose:us-east-1:123456789012:deliverystream/other-stream'],
            sourceKinesisStreamArns: [sourceKinesisStreamArn],
          },
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record], {
        deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream',
        sourceKinesisStreamArn,
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, record, {});

      expect(result).toBeUndefined();
    });

    test('customFilter receives correct FirehoseFilterInput', ({ firehoseRecord }) => {
      const filterSpy = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: { customFilter: filterSpy },
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord({
        recordId: 'filter-input-record',
        approximateArrivalTimestamp: 1704067200,
        kinesisRecordMetadata: {
          shardId: 'shardId-000000000000',
          partitionKey: 'partition-key-1',
          approximateArrivalTimestamp: 1704067200000,
          sequenceNumber: 'seq-123',
          subsequenceNumber: '0',
        },
      });
      const event = createFirehoseEvent([record]);
      const data = { action: 'processOrder' };
      // @ts-expect-error - testing private method directly
      router.matchRoute(event, record, data);

      expect(filterSpy).toHaveBeenCalledWith({
        data,
        recordId: 'filter-input-record',
        approximateArrivalTimestamp: 1704067200,
        record,
        metadata: record.kinesisRecordMetadata,
      });
    });
  });

  suite('processRecord', () => {
    test('returns ProcessingFailed when no route matches', async ({ firehoseRecord, context }) => {
      const record = firehoseRecord();
      const event = createFirehoseEvent([record]);

      // @ts-expect-error - testing private method directly
      const result = await router.processRecord(record, event, context());

      expect(result).toEqual({
        recordId: record.recordId,
        result: 'ProcessingFailed',
        data: record.data,
      });
    });

    test('returns ProcessingFailed when handler throws non-response error', async ({ firehoseRecord, context }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record]);

      // @ts-expect-error - testing private method directly
      const result = await router.processRecord(record, event, context());

      expect(result).toEqual({
        recordId: record.recordId,
        result: 'ProcessingFailed',
        data: record.data,
      });
    });

    test('returns mapped result when handler throws a FirehoseResponse', async ({ firehoseRecord, context }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {
          throw Dropped();
        }),
      );

      const record = firehoseRecord();
      const event = createFirehoseEvent([record]);

      // @ts-expect-error - testing private method directly
      const result = await router.processRecord(record, event, context());

      expect(result).toEqual({
        recordId: record.recordId,
        result: 'Dropped',
        data: record.data,
      });
    });

    test('calls handler with correct request shape', async ({ firehoseRecord, context }) => {
      const handler = vi.fn().mockResolvedValue(Ok());
      router.route(
        defineRoute({
          filters: {},
        }).handle(handler),
      );

      const body = { action: 'processOrder', orderId: '12345' }; // body gets automatically base64 encoded by firehoseRecord
      const record = firehoseRecord({ data: body, approximateArrivalTimestamp: 1704067200 });
      const event = createFirehoseEvent([record]);
      const ctx = context();

      // @ts-expect-error - testing private method directly
      await router.processRecord(record, event, ctx);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: body,
          recordId: record.recordId,
          approximateArrivalTimestamp: 1704067200,
          record,
          context: ctx,
          metadata: undefined,
        }),
      );
    });

    test('includes kinesisRecordMetadata in request when present on record', async ({ firehoseRecord, context }) => {
      const handler = vi.fn().mockResolvedValue(Ok());
      router.route(
        defineRoute({
          filters: {},
        }).handle(handler),
      );

      const kinesisRecordMetadata = {
        shardId: 'shardId-000000000000',
        partitionKey: 'partition-key-1',
        approximateArrivalTimestamp: 1704067200000,
        sequenceNumber: 'seq-123',
        subsequenceNumber: '0',
      };
      const record = firehoseRecord({ kinesisRecordMetadata });
      const event = createFirehoseEvent([record]);

      // @ts-expect-error - testing private method directly
      await router.processRecord(record, event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: kinesisRecordMetadata,
        }),
      );
    });
  });

  suite('mapResponseToResult', () => {
    test('maps Ok response without data (uses original record data)', ({ firehoseRecord }) => {
      const record = firehoseRecord();
      // @ts-expect-error - testing private method directly
      const result = router.mapResponseToResult(record, Ok());

      expect(result).toEqual({
        recordId: record.recordId,
        result: 'Ok',
        data: record.data,
        metadata: undefined,
      });
    });

    test('maps Ok response with data (uses response data)', ({ firehoseRecord }) => {
      const record = firehoseRecord();
      const responseData = Buffer.from('transformed').toString('base64');
      // @ts-expect-error - testing private method directly
      const result = router.mapResponseToResult(record, { status: 'Ok', data: responseData });

      expect(result).toEqual({
        recordId: record.recordId,
        result: 'Ok',
        data: responseData,
        metadata: undefined,
      });
    });

    test('maps Ok response with metadata', ({ firehoseRecord }) => {
      const record = firehoseRecord();
      const metadata = { partitionKeys: { key: 'value' } };
      // @ts-expect-error - testing private method directly
      const result = router.mapResponseToResult(record, { status: 'Ok', data: 'abc', metadata });

      expect(result).toEqual({
        recordId: record.recordId,
        result: 'Ok',
        data: 'abc',
        metadata,
      });
    });

    test('maps Ok response with metadata but no data (uses original record data)', ({ firehoseRecord }) => {
      const record = firehoseRecord();
      const metadata = { partitionKeys: { key: 'value' } };
      // @ts-expect-error - testing private method directly
      const result = router.mapResponseToResult(record, { status: 'Ok', metadata });

      expect(result).toEqual({
        recordId: record.recordId,
        result: 'Ok',
        data: record.data,
        metadata,
      });
    });

    test('maps Dropped response (uses original record data)', ({ firehoseRecord }) => {
      const record = firehoseRecord();
      // @ts-expect-error - testing private method directly
      const result = router.mapResponseToResult(record, Dropped());

      expect(result).toEqual({
        recordId: record.recordId,
        result: 'Dropped',
        data: record.data,
      });
    });

    test('maps ProcessingFailed response (uses original record data)', ({ firehoseRecord }) => {
      const record = firehoseRecord();
      // @ts-expect-error - testing private method directly
      const result = router.mapResponseToResult(record, Failed());

      expect(result).toEqual({
        recordId: record.recordId,
        result: 'ProcessingFailed',
        data: record.data,
      });
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with parsed request', async ({ firehoseRecord, firehoseHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok());
      const deliveryStreamArn = 'arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream';

      const definition = defineRoute({
        filters: { deliveryStreamArns: [deliveryStreamArn] },
      }).handle(handler);
      router.route(definition);

      const body = { action: 'processOrder', orderId: '12345' }; // body gets automatically base64 encoded by firehoseRecord
      const record = firehoseRecord({ data: body, approximateArrivalTimestamp: 1704067200 });
      const { event, context } = firehoseHandlerEvent({
        records: [record],
        eventOverrides: { deliveryStreamArn },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: body,
          recordId: record.recordId,
          approximateArrivalTimestamp: 1704067200,
          record: event.records[0],
          context,
        }),
      );
    });

    test('returns ProcessingFailed result when no route matches', async ({ firehoseHandlerEvent }) => {
      const { event, context } = firehoseHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result.records[0]?.result).toBe('ProcessingFailed');
    });

    test('returns ProcessingFailed when handler throws', async ({ firehoseHandlerEvent }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = firehoseHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result.records[0]?.result).toBe('ProcessingFailed');
    });

    test('returns mapped result from Ok handler response', async ({ firehoseHandlerEvent }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => Ok()),
      );

      const { event, context } = firehoseHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result.records[0]?.result).toBe('Ok');
    });

    test('returns mapped result from Dropped handler response', async ({ firehoseHandlerEvent }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => Dropped()),
      );

      const { event, context } = firehoseHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result.records[0]?.result).toBe('Dropped');
    });

    test('returns mapped result from Failed handler response', async ({ firehoseHandlerEvent }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => Failed()),
      );

      const { event, context } = firehoseHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result.records[0]?.result).toBe('ProcessingFailed');
    });

    test('processes records sequentially', async ({ firehoseRecord, firehoseEvent, context }) => {
      const callOrder: string[] = [];

      router.route(
        defineRoute({
          filters: {},
        }).handle(async (request) => {
          const recordId = request.recordId;
          callOrder.push(`start-${recordId}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${recordId}`);
          return Ok();
        }),
      );

      const recordA = firehoseRecord({ recordId: 'record-a' });
      const recordB = firehoseRecord({ recordId: 'record-b' });
      const event = firehoseEvent([recordA, recordB]);
      await router.handleEvent(event, context());

      expect(callOrder).toEqual(['start-record-a', 'end-record-a', 'start-record-b', 'end-record-b']);
    });

    test('handler receives raw string when record data is not JSON', async ({
      firehoseRecord,
      firehoseEvent,
      context,
    }) => {
      const handler = vi.fn().mockResolvedValue(Ok());
      router.route(defineRoute({ filters: {} }).handle(handler));

      const rawText = 'plain text log line'; // This get automatically base64 encoded by firehoseRecord
      const record = firehoseRecord({ data: rawText });
      const event = firehoseEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: rawText }));
    });

    test('returns results for all records', async ({ firehoseRecord, firehoseEvent, context }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => Ok()),
      );

      const records = [firehoseRecord(), firehoseRecord(), firehoseRecord()];
      const event = firehoseEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result.records).toHaveLength(3);
    });
  });

  suite('handleEvent - Ok response data handling', () => {
    test('Ok() with no data returns Ok result with original data', async ({ firehoseHandlerEvent }) => {
      router.route(defineRoute({ filters: {} }).handle(async () => Ok()));

      const { event, context } = firehoseHandlerEvent();
      const result = await router.handleEvent(event, context);
      const record = result.records[0];

      expect(record?.result).toBe('Ok');
      expect(record?.data).toBe(event.records[0]?.data);
    });

    test('Ok(data) returns Ok result with new base64-encoded data', async ({ firehoseHandlerEvent }) => {
      const transformedBody = { action: 'transformed' };
      router.route(defineRoute({ filters: {} }).handle(async () => Ok(transformedBody)));

      const { event, context } = firehoseHandlerEvent();
      const result = await router.handleEvent(event, context);
      const record = result.records[0];
      const expectedData = Buffer.from(JSON.stringify(transformedBody)).toString('base64');

      expect(record?.result).toBe('Ok');
      expect(record?.data).toBe(expectedData);
    });

    test('Ok(data, metadata) returns Ok result with data and metadata', async ({ firehoseHandlerEvent }) => {
      const metadata = { partitionKeys: { key: 'value' } };
      router.route(defineRoute({ filters: {} }).handle(async () => Ok('hello', metadata)));

      const { event, context } = firehoseHandlerEvent();
      const result = await router.handleEvent(event, context);
      const record = result.records[0];

      expect(record?.result).toBe('Ok');
      expect(record?.metadata).toEqual(metadata);
    });
  });

  suite('handleEvent - schema validation', () => {
    test('handler receives validated data from dataSchema', async ({ firehoseRecord, firehoseEvent, context }) => {
      const handler = vi.fn().mockResolvedValue(Ok());
      const dataSchema = createMockSchema();

      router.route(
        defineRoute({
          filters: {},
          dataSchema,
        }).handle(handler),
      );

      const body = { action: 'processOrder', orderId: '12345' };
      const record = firehoseRecord({ data: body });
      const event = firehoseEvent([record]);
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith(body, dataSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: body }));
    });

    test('returns ProcessingFailed when dataSchema fails', async ({ firehoseRecord, firehoseEvent, context }) => {
      const dataSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.route(
        defineRoute({
          filters: {},
          dataSchema,
        }).handle(async () => Ok()),
      );

      const record = firehoseRecord();
      const event = firehoseEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result.records[0]?.result).toBe('ProcessingFailed');
    });
  });

  suite('handleEvent - jsonParse', () => {
    test('passes decoded firehose data to safeJsonParse', async ({ firehoseRecord, firehoseEvent, context }) => {
      const handler = vi.fn().mockResolvedValue(Ok());
      router.route(
        defineRoute({
          filters: {},
        }).handle(handler),
      );

      const body = { action: 'processOrder', orderId: '12345' };
      const record = firehoseRecord({ data: body });
      const event = firehoseEvent([record]);
      await router.handleEvent(event, context());

      expect(safeJsonParseSpy).toHaveBeenCalledWith(JSON.stringify(body));
    });

    test('handler receives parsed object when data is valid JSON', async ({
      firehoseRecord,
      firehoseEvent,
      context,
    }) => {
      const handler = vi.fn().mockResolvedValue(Ok());
      router.route(
        defineRoute({
          filters: {},
        }).handle(handler),
      );

      const body = { action: 'processOrder', orderId: '12345' };
      const record = firehoseRecord({ data: body });
      const event = firehoseEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: body }));
    });

    test('handler receives raw string when data is not valid JSON', async ({
      firehoseRecord,
      firehoseEvent,
      context,
    }) => {
      const handler = vi.fn().mockResolvedValue(Ok());
      router.route(
        defineRoute({
          filters: {},
        }).handle(handler),
      );

      const record = firehoseRecord({ data: 'not-json' });
      const event = firehoseEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: 'not-json' }));
    });
  });

  suite('handleEvent - error handling', () => {
    test('thrown FirehoseResponse is caught and mapped to result', async ({ firehoseHandlerEvent }) => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw Dropped();
        }),
      );

      const { event, context } = firehoseHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result.records[0]?.result).toBe('Dropped');
    });

    test('thrown non-response error results in ProcessingFailed', async ({ firehoseHandlerEvent }) => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('unexpected');
        }),
      );

      const { event, context } = firehoseHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result.records[0]?.result).toBe('ProcessingFailed');
    });
  });

  suite('full event processing', () => {
    test('routes records to different handlers based on deliveryStreamArn filters', async ({
      firehoseRecord,
      context,
    }) => {
      const streamAHandler = vi.fn().mockResolvedValue(Ok());
      const streamBHandler = vi.fn().mockResolvedValue(Ok());

      const streamAArn = 'arn:aws:firehose:us-east-1:123456789012:deliverystream/stream-a';
      const streamBArn = 'arn:aws:firehose:us-east-1:123456789012:deliverystream/stream-b';

      router.route(
        defineRoute({
          filters: { deliveryStreamArns: [streamAArn] },
        }).handle(streamAHandler),
      );
      router.route(
        defineRoute({
          filters: { deliveryStreamArns: [streamBArn] },
        }).handle(streamBHandler),
      );

      const records = [firehoseRecord(), firehoseRecord()];
      const event = createFirehoseEvent(records, { deliveryStreamArn: streamAArn });
      const result = await router.handleEvent(event, context());

      expect(streamAHandler).toHaveBeenCalledTimes(2);
      expect(streamBHandler).not.toHaveBeenCalled();
      expect(result.records).toHaveLength(2);
      expect(result.records[0]?.result).toBe('Ok');
    });

    test('multiple records with mixed match and no-match', async ({ firehoseRecord, context }) => {
      const matchingArn = 'arn:aws:firehose:us-east-1:123456789012:deliverystream/match';
      const handler = vi.fn().mockResolvedValue(Ok());
      router.route(
        defineRoute({
          filters: { deliveryStreamArns: [matchingArn] },
        }).handle(handler),
      );

      const records = [firehoseRecord(), firehoseRecord(), firehoseRecord()];
      // Event deliveryStreamArn won't match the filter
      const event = createFirehoseEvent(records, {
        deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789012:deliverystream/no-match',
      });
      const result = await router.handleEvent(event, context());

      expect(handler).not.toHaveBeenCalled();
      expect(result.records).toHaveLength(3);
      for (const record of result.records) {
        expect(record.result).toBe('ProcessingFailed');
      }
    });
  });
  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ firehoseHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: FirehoseRequest, next: FirehoseNext): Promise<FirehoseResponseResult> {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      }

      const router = createFirehoseRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
          return Ok();
        },
      });

      const { event, context } = firehoseHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ firehoseHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: FirehoseRequest, _next: FirehoseNext): Promise<FirehoseResponseResult> {
        return Dropped();
      }

      const router = createFirehoseRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = firehoseHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ firehoseHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: FirehoseRequest, next: FirehoseNext): Promise<FirehoseResponseResult> {
        callOrder.push('mw1');
        return next(request);
      }

      async function middlewareTwo(request: FirehoseRequest, next: FirehoseNext): Promise<FirehoseResponseResult> {
        callOrder.push('mw2');
        return next(request);
      }

      const router = createFirehoseRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
          return Ok();
        },
      });

      const { event, context } = firehoseHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ firehoseHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: FirehoseRequest, next: FirehoseNext): Promise<FirehoseResponseResult> {
        callOrder.push('route-mw');
        return next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return Ok();
        },
      });

      const { event, context } = firehoseHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ firehoseHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(
        _request: FirehoseRequest,
        _next: FirehoseNext,
      ): Promise<FirehoseResponseResult> {
        return Dropped();
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = firehoseHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ firehoseHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(
        request: FirehoseRequest,
        next: FirehoseNext,
      ): Promise<FirehoseResponseResult> {
        callOrder.push('route-mw1');
        return next(request);
      }

      async function routeMiddlewareTwo(
        request: FirehoseRequest,
        next: FirehoseNext,
      ): Promise<FirehoseResponseResult> {
        callOrder.push('route-mw2');
        return next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
          return Ok();
        },
      });

      const { event, context } = firehoseHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ firehoseHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: FirehoseRequest, next: FirehoseNext): Promise<FirehoseResponseResult> {
        callOrder.push('route-mw');
        return next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
        return Ok();
      });

      router.route(route);

      const { event, context } = firehoseHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ firehoseHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: FirehoseRequest, next: FirehoseNext): Promise<FirehoseResponseResult> {
        callOrder.push('router-mw');
        return next(request);
      }

      async function routeMiddleware(request: FirehoseRequest, next: FirehoseNext): Promise<FirehoseResponseResult> {
        callOrder.push('route-mw');
        return next(request);
      }

      const router = createFirehoseRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return Ok();
        },
      });

      const { event, context } = firehoseHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({ firehoseHandlerEvent }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(
        _request: FirehoseRequest,
        _next: FirehoseNext,
      ): Promise<FirehoseResponseResult> {
        return Dropped();
      }

      const router = createFirehoseRouter({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = firehoseHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async ({ firehoseHandlerEvent }) => {
      const middleware = vi.fn();
      const dataSchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const router = createFirehoseRouter({ middleware: [middleware] });
      router.route({ filters: {}, dataSchema, handler: async () => Ok() });

      const { event, context } = firehoseHandlerEvent();
      // Schema validation failure in firehose results in Failed status, not a throw
      const result = await router.handleEvent(event, context);

      expect(result.records[0]?.result).toBe('ProcessingFailed');
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});
