import * as base from '@lambda-event-router/base';
import { createDynamoDBEvent, createMockSchema, test } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
import { createDynamoDBRouter, defineRoute, DynamoDBRouter } from './DynamoDBRouter.js';
import type { DynamoDBFilterInput, DynamoDBInsertRequest, DynamoDBRequest } from './types.js';

type DynamoDBNext = (request: DynamoDBRequest) => Promise<void>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');

suite('DynamoDBRouter', () => {
  let router: DynamoDBRouter;

  beforeEach(() => {
    router = new DynamoDBRouter();
  });

  suite('createDynamoDBRouter', () => {
    test('creates a DynamoDBRouter instance', () => {
      const router = createDynamoDBRouter();
      expect(router).toBeInstanceOf(DynamoDBRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid DynamoDB stream event', () => {
      const event = createDynamoDBEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for a non-DynamoDB event', () => {
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false when Records is not an array', () => {
      expect(router.canHandleEvent({ Records: 'not-an-array' })).toBe(false);
    });

    test('returns false when first record is not an object', () => {
      expect(router.canHandleEvent({ Records: ['not-an-object'] })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { eventNames: ['INSERT'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, schemas, and handler in the definition', () => {
      const keysSchema = createMockSchema();
      const newImageSchema = createMockSchema();
      const oldImageSchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        eventNames: ['MODIFY' as const],
        eventSourceArns: ['arn:aws:dynamodb:us-east-1:123456789012:table/my-table/stream/2024-01-01T00:00:00.000'],
        streamViewTypes: ['NEW_AND_OLD_IMAGES' as const],
      };

      const definition = defineRoute({
        filters,
        keysSchema,
        newImageSchema,
        oldImageSchema,
      }).handle(handler);

      expect(definition.filters).toEqual(filters);
      expect(definition.keysSchema).toBe(keysSchema);
      expect(definition.newImageSchema).toBe(newImageSchema);
      expect(definition.oldImageSchema).toBe(oldImageSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: { eventNames: ['INSERT'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('insert', () => {
    test('returns the router instance for chaining', () => {
      const result = router.insert({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('only matches INSERT records', ({ dynamoDBInsertRecord }) => {
      router.insert({ filters: {}, handler: async () => {} });

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      const insertResult = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');
      // @ts-expect-error - testing private method directly
      const modifyResult = router.matchRoute(record, 'MODIFY', 'NEW_AND_OLD_IMAGES');
      // @ts-expect-error - testing private method directly
      const removeResult = router.matchRoute(record, 'REMOVE', 'NEW_AND_OLD_IMAGES');

      expect(insertResult).toBeDefined();
      expect(modifyResult).toBeUndefined();
      expect(removeResult).toBeUndefined();
    });
  });

  suite('modify', () => {
    test('returns the router instance for chaining', () => {
      const result = router.modify({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('only matches MODIFY records', ({ dynamoDBModifyRecord }) => {
      router.modify({ filters: {}, handler: async () => {} });

      const record = dynamoDBModifyRecord();
      // @ts-expect-error - testing private method directly
      const insertResult = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');
      // @ts-expect-error - testing private method directly
      const modifyResult = router.matchRoute(record, 'MODIFY', 'NEW_AND_OLD_IMAGES');
      // @ts-expect-error - testing private method directly
      const removeResult = router.matchRoute(record, 'REMOVE', 'NEW_AND_OLD_IMAGES');

      expect(insertResult).toBeUndefined();
      expect(modifyResult).toBeDefined();
      expect(removeResult).toBeUndefined();
    });
  });

  suite('remove', () => {
    test('returns the router instance for chaining', () => {
      const result = router.remove({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('only matches REMOVE records', ({ dynamoDBRemoveRecord }) => {
      router.remove({ filters: {}, handler: async () => {} });

      const record = dynamoDBRemoveRecord();
      // @ts-expect-error - testing private method directly
      const insertResult = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');
      // @ts-expect-error - testing private method directly
      const modifyResult = router.matchRoute(record, 'MODIFY', 'NEW_AND_OLD_IMAGES');
      // @ts-expect-error - testing private method directly
      const removeResult = router.matchRoute(record, 'REMOVE', 'NEW_AND_OLD_IMAGES');

      expect(insertResult).toBeUndefined();
      expect(modifyResult).toBeUndefined();
      expect(removeResult).toBeDefined();
    });
  });

  suite('matchRoute', () => {
    test('matches route by eventNames', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: { eventNames: ['INSERT'] },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeDefined();
    });

    test('does not match route when eventNames does not match', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: { eventNames: ['REMOVE'] },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeUndefined();
    });

    test('matches route by eventSourceArns', ({ dynamoDBInsertRecord }) => {
      const tableArn = 'arn:aws:dynamodb:us-east-1:123456789012:table/orders/stream/2024-01-01T00:00:00.000';
      router.route(
        defineRoute({
          filters: { eventSourceArns: [tableArn] },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord({ eventSourceARN: tableArn });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeDefined();
    });

    test('does not match route when eventSourceArns does not match', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: {
            eventSourceArns: [
              'arn:aws:dynamodb:us-east-1:123456789012:table/other-table/stream/2024-01-01T00:00:00.000',
            ],
          },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord({
        eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789012:table/my-table/stream/2024-01-01T00:00:00.000',
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeUndefined();
    });

    test('matches route by streamViewTypes', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: { streamViewTypes: ['NEW_AND_OLD_IMAGES'] },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeDefined();
    });

    test('does not match route when streamViewTypes does not match', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: { streamViewTypes: ['KEYS_ONLY'] },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ eventName }: DynamoDBFilterInput): boolean => {
              return eventName === 'INSERT';
            },
          },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeUndefined();
    });

    test('customFilter receives correct DynamoDBFilterInput', ({ dynamoDBInsertRecord }) => {
      const filterSpy = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: { customFilter: filterSpy },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(filterSpy).toHaveBeenCalledWith({
        eventName: 'INSERT',
        streamViewType: 'NEW_AND_OLD_IMAGES',
        record,
      });
    });

    test('customFilter is not called when a preceding filter rejects', ({ dynamoDBInsertRecord }) => {
      const customFilterSpy = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: { eventNames: ['REMOVE'], customFilter: customFilterSpy },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(customFilterSpy).not.toHaveBeenCalled();
    });

    test('matches route with empty filters as a catch-all', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', ({ dynamoDBInsertRecord }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.route(
        defineRoute({
          filters: { eventNames: ['INSERT'] },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { eventNames: ['INSERT'] },
        }).handle(secondHandler),
      );

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('does not match when eventNames matches but eventSourceArns does not', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: {
            eventNames: ['INSERT'],
            eventSourceArns: [
              'arn:aws:dynamodb:us-east-1:123456789012:table/other-table/stream/2024-01-01T00:00:00.000',
            ],
          },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord({
        eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789012:table/my-table/stream/2024-01-01T00:00:00.000',
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeUndefined();
    });

    test('matches when all three filters match', ({ dynamoDBInsertRecord }) => {
      const tableArn = 'arn:aws:dynamodb:us-east-1:123456789012:table/orders/stream/2024-01-01T00:00:00.000';
      router.route(
        defineRoute({
          filters: {
            eventNames: ['INSERT'],
            eventSourceArns: [tableArn],
            streamViewTypes: ['NEW_AND_OLD_IMAGES'],
          },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord({ eventSourceARN: tableArn });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeDefined();
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler with the parsed request', async ({ dynamoDBStreamHandlerEvent }) => {
      const handler = vi.fn();
      router.insert({
        filters: {},
        handler,
      });

      const { event, context } = dynamoDBStreamHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          keys: { pk: 'pk-123', sk: 'sk-123' },
          newImage: { pk: 'pk-123', sk: 'sk-123', name: 'Test Item' },
          eventName: 'INSERT',
          record: event.Records[0],
          context,
        }),
      );
    });

    test('handler receives undefined for newImage on REMOVE', async ({
      dynamoDBRemoveRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const handler = vi.fn();
      router.remove({ filters: {}, handler });

      const record = dynamoDBRemoveRecord();
      const event = dynamoDBStreamEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          newImage: undefined,
          oldImage: { pk: 'pk-123', sk: 'sk-123', name: 'Deleted Item' },
          eventName: 'REMOVE',
        }),
      );
    });

    test('handler receives undefined for oldImage on INSERT', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const handler = vi.fn();
      router.insert({ filters: {}, handler });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          oldImage: undefined,
          eventName: 'INSERT',
        }),
      );
    });

    test('throws when no route matches and batchItemFailures is disabled', async ({ dynamoDBStreamHandlerEvent }) => {
      const { event, context } = dynamoDBStreamHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler errors', async ({ dynamoDBStreamHandlerEvent }) => {
      router.insert({
        filters: {},
        handler: async () => {
          throw new Error('handler exploded');
        },
      });

      const { event, context } = dynamoDBStreamHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('returns undefined on success when batchItemFailures is disabled', async ({ dynamoDBStreamHandlerEvent }) => {
      router.insert({ filters: {}, handler: async () => {} });

      const { event, context } = dynamoDBStreamHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('processes records sequentially', async ({ dynamoDBInsertRecord, dynamoDBStreamEvent, context }) => {
      const callOrder: string[] = [];

      router.insert({
        filters: {},
        handler: async (request: DynamoDBInsertRequest) => {
          const eventId = request.record.eventID;
          callOrder.push(`start-${eventId}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${eventId}`);
        },
      });

      const recordA = dynamoDBInsertRecord();
      const recordB = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([recordA, recordB]);
      await router.handleEvent(event, context());

      // Sequential: first record must finish before second starts
      expect(callOrder).toEqual([
        `start-${recordA.eventID}`,
        `end-${recordA.eventID}`,
        `start-${recordB.eventID}`,
        `end-${recordB.eventID}`,
      ]);
    });
  });

  suite('handleEvent - batchItemFailures', () => {
    let router: DynamoDBRouter;

    beforeEach(() => {
      router = new DynamoDBRouter({ batchItemFailures: true });
    });

    test('returns undefined when all records succeed', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      router.insert({ filters: {}, handler: async () => {} });

      const records = [dynamoDBInsertRecord(), dynamoDBInsertRecord(), dynamoDBInsertRecord()];
      const event = dynamoDBStreamEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
    });

    test('returns failed record eventID as itemIdentifier', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const failingRecord = dynamoDBInsertRecord();

      router.insert({
        filters: {},
        handler: async (request: DynamoDBInsertRequest) => {
          if (request.record.eventID === failingRecord.eventID) {
            throw new Error('processing failed');
          }
        },
      });

      const event = dynamoDBStreamEvent([failingRecord]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: failingRecord.eventID }],
      });
    });

    test('marks failed record and all remaining records as failures', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const recordA = dynamoDBInsertRecord();
      const failingRecord = dynamoDBInsertRecord();
      const recordC = dynamoDBInsertRecord();
      const recordD = dynamoDBInsertRecord();
      router.insert({
        filters: {},
        handler: async (request: DynamoDBInsertRequest) => {
          if (request.record.eventID === failingRecord.eventID) {
            throw new Error('processing failed');
          }
        },
      });

      const event = dynamoDBStreamEvent([recordA, failingRecord, recordC, recordD]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [
          { itemIdentifier: failingRecord.eventID },
          { itemIdentifier: recordC.eventID },
          { itemIdentifier: recordD.eventID },
        ],
      });
    });

    test('returns batchItemFailures when no route matches', async ({ dynamoDBStreamHandlerEvent }) => {
      const { event, context } = dynamoDBStreamHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: event.Records[0]?.eventID }],
      });
    });

    test('only processes records up to first failure', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const recordA = dynamoDBInsertRecord();
      const recordC = dynamoDBInsertRecord();
      const failingRecord = dynamoDBInsertRecord();

      const handler = vi.fn().mockImplementation(async (request: DynamoDBInsertRequest) => {
        if (request.record.eventID === failingRecord.eventID) {
          throw new Error('processing failed');
        }
      });

      router.insert({ filters: {}, handler });

      const event = dynamoDBStreamEvent([recordA, failingRecord, recordC]);
      await router.handleEvent(event, context());

      // Only recordA and failingRecord are processed; recordC is never called
      expect(handler).toHaveBeenCalledTimes(2);
    });

    test('first record failure marks all records as failed', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      router.insert({
        filters: {},
        handler: async () => {
          throw new Error('first record failed');
        },
      });

      const recordA = dynamoDBInsertRecord();
      const recordB = dynamoDBInsertRecord();
      const recordC = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([recordA, recordB, recordC]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [
          { itemIdentifier: recordA.eventID },
          { itemIdentifier: recordB.eventID },
          { itemIdentifier: recordC.eventID },
        ],
      });
    });

    test('last record failure only includes that record', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const recordA = dynamoDBInsertRecord();
      const recordB = dynamoDBInsertRecord();
      const lastRecord = dynamoDBInsertRecord();

      router.insert({
        filters: {},
        handler: async (request: DynamoDBInsertRequest) => {
          if (request.record.eventID === lastRecord.eventID) {
            throw new Error('last record failed');
          }
        },
      });

      const event = dynamoDBStreamEvent([recordA, recordB, lastRecord]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: lastRecord.eventID }],
      });
    });
  });

  suite('handleEvent - schema validation', () => {
    test('handler receives validated keys from keysSchema', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const handler = vi.fn();
      const keysSchema = createMockSchema();
      router.insert({ filters: {}, keysSchema, handler });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith({ pk: 'pk-123', sk: 'sk-123' }, keysSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ keys: { pk: 'pk-123', sk: 'sk-123' } }));
    });

    test('throws when keysSchema validation fails and batchItemFailures is disabled', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const keysSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.insert({ filters: {}, keysSchema, handler: async () => {} });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      await expect(router.handleEvent(event, context())).rejects.toThrow('Image validation failed for Keys');
    });

    test('returns batchItemFailure when keysSchema validation fails', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const router = new DynamoDBRouter({ batchItemFailures: true });
      const keysSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.insert({ filters: {}, keysSchema, handler: async () => {} });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: record.eventID }],
      });
    });

    test('handler receives validated newImage from newImageSchema', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const handler = vi.fn();
      const newImageSchema = createMockSchema();
      router.insert({ filters: {}, newImageSchema, handler });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith(
        { pk: 'pk-123', sk: 'sk-123', name: 'Test Item' },
        newImageSchema,
        expect.any(String),
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ newImage: { pk: 'pk-123', sk: 'sk-123', name: 'Test Item' } }),
      );
    });

    test('throws when newImageSchema validation fails and batchItemFailures is disabled', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const newImageSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.insert({ filters: {}, newImageSchema, handler: async () => {} });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      await expect(router.handleEvent(event, context())).rejects.toThrow('Image validation failed for NewImage');
    });

    test('returns batchItemFailure when newImageSchema validation fails', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const router = new DynamoDBRouter({ batchItemFailures: true });
      const newImageSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.insert({ filters: {}, newImageSchema, handler: async () => {} });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: record.eventID }],
      });
    });

    test('handler receives validated oldImage from oldImageSchema', async ({
      dynamoDBModifyRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const handler = vi.fn();
      const oldImageSchema = createMockSchema();
      router.modify({ filters: {}, oldImageSchema, handler });

      const record = dynamoDBModifyRecord();
      const event = dynamoDBStreamEvent([record]);
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith(
        { pk: 'pk-123', sk: 'sk-123', name: 'Old Item' },
        oldImageSchema,
        expect.any(String),
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ oldImage: { pk: 'pk-123', sk: 'sk-123', name: 'Old Item' } }),
      );
    });

    test('throws when oldImageSchema validation fails and batchItemFailures is disabled', async ({
      dynamoDBModifyRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const oldImageSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.modify({ filters: {}, oldImageSchema, handler: async () => {} });

      const record = dynamoDBModifyRecord();
      const event = dynamoDBStreamEvent([record]);
      await expect(router.handleEvent(event, context())).rejects.toThrow('Image validation failed for OldImage');
    });

    test('returns batchItemFailure when oldImageSchema validation fails', async ({
      dynamoDBModifyRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const router = new DynamoDBRouter({ batchItemFailures: true });
      const oldImageSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.modify({ filters: {}, oldImageSchema, handler: async () => {} });

      const record = dynamoDBModifyRecord();
      const event = dynamoDBStreamEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: record.eventID }],
      });
    });

    test('passes undefined newImage through validation on REMOVE', async ({
      dynamoDBRemoveRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const handler = vi.fn();
      const newImageSchema = createMockSchema();
      router.route({
        filters: { eventNames: ['REMOVE'] },
        newImageSchema,
        handler,
      });

      const record = dynamoDBRemoveRecord();
      const event = dynamoDBStreamEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ newImage: undefined }));
    });
  });

  suite('full event processing', () => {
    test('routes all three event types to respective handlers', async ({
      dynamoDBInsertRecord,
      dynamoDBModifyRecord,
      dynamoDBRemoveRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const insertHandler = vi.fn();
      const modifyHandler = vi.fn();
      const removeHandler = vi.fn();

      router.insert({ filters: {}, handler: insertHandler });
      router.modify({ filters: {}, handler: modifyHandler });
      router.remove({ filters: {}, handler: removeHandler });

      const insertRecord = dynamoDBInsertRecord();
      const modifyRecord = dynamoDBModifyRecord();
      const removeRecord = dynamoDBRemoveRecord();
      const event = dynamoDBStreamEvent([insertRecord, modifyRecord, removeRecord]);
      await router.handleEvent(event, context());

      expect(insertHandler).toHaveBeenCalledTimes(1);
      expect(modifyHandler).toHaveBeenCalledTimes(1);
      expect(removeHandler).toHaveBeenCalledTimes(1);
    });

    test('routes by eventSourceArns for different tables', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const ordersArn = 'arn:aws:dynamodb:us-east-1:123456789012:table/orders/stream/2024-01-01T00:00:00.000';
      const usersArn = 'arn:aws:dynamodb:us-east-1:123456789012:table/users/stream/2024-01-01T00:00:00.000';

      const ordersHandler = vi.fn();
      const usersHandler = vi.fn();

      router.insert({ filters: { eventSourceArns: [ordersArn] }, handler: ordersHandler });
      router.insert({ filters: { eventSourceArns: [usersArn] }, handler: usersHandler });

      const ordersRecord = dynamoDBInsertRecord({ eventSourceARN: ordersArn });
      const usersRecord = dynamoDBInsertRecord({ eventSourceARN: usersArn });
      const event = dynamoDBStreamEvent([ordersRecord, usersRecord]);
      await router.handleEvent(event, context());

      expect(ordersHandler).toHaveBeenCalledTimes(1);
      expect(usersHandler).toHaveBeenCalledTimes(1);
    });

    test('catch-all route handles all event types', async ({
      dynamoDBInsertRecord,
      dynamoDBModifyRecord,
      dynamoDBRemoveRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const handler = vi.fn();

      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = dynamoDBStreamEvent([dynamoDBInsertRecord(), dynamoDBModifyRecord(), dynamoDBRemoveRecord()]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler for each record', async ({ dynamoDBStreamHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: DynamoDBRequest, next: DynamoDBNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createDynamoDBRouter({ middleware: [middleware] });
      router.insert({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = dynamoDBStreamHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('executes middleware per-record for multi-record events', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const recordIds: string[] = [];

      async function middleware(request: DynamoDBRequest, next: DynamoDBNext): Promise<void> {
        recordIds.push(request.record.eventID ?? '');
        await next(request);
      }

      const router = createDynamoDBRouter({ middleware: [middleware] });
      router.insert({ filters: {}, handler: async () => {} });

      const recordA = dynamoDBInsertRecord({ eventID: 'evt-1' });
      const recordB = dynamoDBInsertRecord({ eventID: 'evt-2' });
      const event = dynamoDBStreamEvent([recordA, recordB]);
      await router.handleEvent(event, context());

      expect(recordIds).toEqual(['evt-1', 'evt-2']);
    });

    test('allows middleware to skip a record by not calling next', async ({ dynamoDBStreamHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: DynamoDBRequest, _next: DynamoDBNext): Promise<void> {
        return;
      }

      const router = createDynamoDBRouter({ middleware: [skipMiddleware] });
      router.insert({ filters: {}, handler });

      const { event, context } = dynamoDBStreamHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ dynamoDBStreamHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: DynamoDBRequest, next: DynamoDBNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: DynamoDBRequest, next: DynamoDBNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createDynamoDBRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.insert({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = dynamoDBStreamHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ dynamoDBStreamHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: DynamoDBRequest, next: DynamoDBNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      router.insert({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = dynamoDBStreamHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({
      dynamoDBStreamHandlerEvent,
    }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: DynamoDBRequest, _next: DynamoDBNext): Promise<void> {
        return;
      }

      router.insert({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = dynamoDBStreamHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ dynamoDBStreamHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: DynamoDBRequest, next: DynamoDBNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: DynamoDBRequest, next: DynamoDBNext): Promise<void> {
        callOrder.push('route-mw2');
        await next(request);
      }

      router.insert({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = dynamoDBStreamHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ dynamoDBStreamHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: DynamoDBRequest, next: DynamoDBNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRoute({
        filters: {},
        middleware: [routeMiddleware],
      }).handle(async () => {
        callOrder.push('handler');
      });

      router.route(route);

      const { event, context } = dynamoDBStreamHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ dynamoDBStreamHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: DynamoDBRequest, next: DynamoDBNext): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: DynamoDBRequest, next: DynamoDBNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createDynamoDBRouter({ middleware: [routerMiddleware] });
      router.insert({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = dynamoDBStreamHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({
      dynamoDBStreamHandlerEvent,
    }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: DynamoDBRequest, _next: DynamoDBNext): Promise<void> {
        return;
      }

      const router = createDynamoDBRouter({ middleware: [blockingRouterMiddleware] });
      router.insert({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = dynamoDBStreamHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async ({ dynamoDBStreamHandlerEvent }) => {
      const middleware = vi.fn();
      const keysSchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const router = createDynamoDBRouter({ middleware: [middleware] });
      router.insert({ filters: {}, keysSchema, handler: vi.fn() });

      const { event, context } = dynamoDBStreamHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('Image validation failed for Keys');
      expect(middleware).not.toHaveBeenCalled();
    });
  });

  suite('batch item failures with middleware', () => {
    test('middleware errors are tracked as batch item failures', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const handler = vi.fn();

      async function failingMiddleware(_request: DynamoDBRequest, _next: DynamoDBNext): Promise<void> {
        throw new Error('middleware error');
      }

      const router = createDynamoDBRouter({ batchItemFailures: true, middleware: [failingMiddleware] });
      router.insert({ filters: {}, handler });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: record.eventID }],
      });
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
