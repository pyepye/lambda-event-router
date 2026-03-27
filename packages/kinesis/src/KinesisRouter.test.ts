import * as base from '@lambda-event-router/base';
import { createKinesisEvent, createMockSchema, test } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
import { createKinesisRouter, defineRoute, KinesisRouter } from './KinesisRouter.js';
import type { KinesisFilterInput } from './types.js';

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');
const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');

let router: KinesisRouter;

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
        filters: { eventSourceArns: ['arn:aws:kinesis:us-east-1:123456789012:stream/my-stream'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, dataSchema, and handler in the definition', () => {
      const dataSchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        eventSourceArns: ['arn:aws:kinesis:us-east-1:123456789012:stream/my-stream'],
        partitionKeys: ['partition-key-1'],
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
        filters: { eventSourceArns: ['arn:aws:kinesis:us-east-1:123456789012:stream/my-stream'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches route by eventSourceArns', ({ kinesisRecord }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {});

      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArns does not match', ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:kinesis:us-east-1:123456789012:stream/other-stream'] },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ eventSourceARN: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream' });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {});

      expect(result).toBeUndefined();
    });

    test('matches route by partitionKeys', ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: { partitionKeys: ['partition-key-1'] },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ kinesis: { partitionKey: 'partition-key-1' } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {});

      expect(result).toBeDefined();
    });

    test('does not match when partitionKeys does not match', ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: { partitionKeys: ['partition-key-2'] },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ kinesis: { partitionKey: 'partition-key-1' } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {});

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ data }: KinesisFilterInput): boolean => {
              // @ts-expect-error - data is unknown, testing filter with known shape
              return data.action === 'processOrder';
            },
          },
        }).handle(async () => {}),
      );

      const record = kinesisRecord();
      const data = { action: 'processOrder' };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, data);

      expect(result).toBeDefined();
    });

    test('does not match when customFilter returns false', ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const record = kinesisRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {});

      expect(result).toBeUndefined();
    });

    test('matches with empty filters as catch-all', ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const record = kinesisRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {});

      expect(result).toBeDefined();
    });

    test('selects first matching route when multiple match', ({ kinesisRecord }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:kinesis:us-east-1:123456789012:stream/my-stream'] },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:kinesis:us-east-1:123456789012:stream/my-stream'] },
        }).handle(secondHandler),
      );

      const record = kinesisRecord({
        eventSourceARN: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream',
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {});

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('matches when both eventSourceArns and partitionKeys match', ({ kinesisRecord }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      router.route(
        defineRoute({
          filters: {
            eventSourceArns: [eventSourceArn],
            partitionKeys: ['partition-key-1'],
          },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({
        eventSourceARN: eventSourceArn,
        kinesis: { partitionKey: 'partition-key-1' },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {});

      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArns matches but partitionKeys does not', ({ kinesisRecord }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      router.route(
        defineRoute({
          filters: {
            eventSourceArns: [eventSourceArn],
            partitionKeys: ['partition-key-2'],
          },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({
        eventSourceARN: eventSourceArn,
        kinesis: { partitionKey: 'partition-key-1' },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {});

      expect(result).toBeUndefined();
    });

    test('does not match when partitionKeys matches but eventSourceArns does not', ({ kinesisRecord }) => {
      router.route(
        defineRoute({
          filters: {
            eventSourceArns: ['arn:aws:kinesis:us-east-1:123456789012:stream/other-stream'],
            partitionKeys: ['partition-key-1'],
          },
        }).handle(async () => {}),
      );

      const record = kinesisRecord({
        eventSourceARN: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream',
        kinesis: { partitionKey: 'partition-key-1' },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, {});

      expect(result).toBeUndefined();
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler with the parsed request', async ({ kinesisRecord, kinesisHandlerEvent }) => {
      const handler = vi.fn();
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';

      const definition = defineRoute({
        filters: { eventSourceArns: [eventSourceArn] },
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
          filters: { eventSourceArns: [eventSourceArn] },
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
          filters: { eventSourceArns: [eventSourceArn] },
        }).handle(async (request) => {
          const eventId = request.record.eventID;
          callOrder.push(`start-${eventId}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
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
        batchItemFailures: [{ itemIdentifier: event.Records[0]?.eventID }],
      });
    });

    test('returns undefined when all records succeed', async ({ kinesisRecord, kinesisEvent, context }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
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
          filters: { eventSourceArns: [eventSourceArn] },
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
          { itemIdentifier: record2.eventID },
          { itemIdentifier: record3.eventID },
          { itemIdentifier: record4.eventID },
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
          filters: { eventSourceArns: [eventSourceArn] },
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
          filters: { eventSourceArns: [eventSourceArn] },
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
          filters: { eventSourceArns: [eventSourceArn] },
          dataSchema,
        }).handle(async () => {}),
      );

      const record = kinesisRecord({ eventSourceARN: eventSourceArn });
      const event = kinesisEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: record.eventID }],
      });
    });
  });

  suite('handleEvent - jsonParse', () => {
    test('passes decoded kinesis data to safeJsonParse', async ({ kinesisRecord, kinesisEvent, context }) => {
      const eventSourceArn = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream';
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
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
          filters: { eventSourceArns: [eventSourceArn] },
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
          filters: { eventSourceArns: [eventSourceArn] },
        }).handle(handler),
      );

      const record = kinesisRecord({ eventSourceARN: eventSourceArn, kinesis: { data: 'not-json' } });
      const event = kinesisEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: 'not-json' }));
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
          filters: { eventSourceArns: [streamAArn] },
        }).handle(streamAHandler),
      );
      router.route(
        defineRoute({
          filters: { eventSourceArns: [streamBArn] },
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
});
