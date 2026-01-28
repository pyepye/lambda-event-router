import type { Schema } from '@lambda-event-router/base';
import { createDynamoDBStreamEvent, test } from '@lambda-event-router/testing';
import { createDynamoDBStreamRouter, DynamoDBStreamRouter, defineRoute } from './DynamoDBStreamRouter.js';
import type { DynamoDBStreamFilterInput, DynamoDBStreamInsertRequest } from './types.js';

suite('DynamoDBStreamRouter', () => {
  suite('createDynamoDBStreamRouter', () => {
    test('creates a DynamoDBStreamRouter instance', () => {
      const router = createDynamoDBStreamRouter();
      expect(router).toBeInstanceOf(DynamoDBStreamRouter);
    });
  });

  suite('canHandleEvent', () => {
    let router: DynamoDBStreamRouter;

    beforeEach(() => {
      router = new DynamoDBStreamRouter();
    });

    test('returns true for a valid DynamoDB stream event', () => {
      const event = createDynamoDBStreamEvent();
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
      const keysSchema: Schema<{ pk: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { pk: string } }),
      };
      const newImageSchema: Schema<{ name: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { name: string } }),
      };
      const oldImageSchema: Schema<{ name: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { name: string } }),
      };
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

      expect(definition).toEqual({
        filters,
        keysSchema,
        newImageSchema,
        oldImageSchema,
        handler,
      });
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const router = new DynamoDBStreamRouter();
      const definition = defineRoute({
        filters: { eventNames: ['INSERT'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('insert', () => {
    test('returns the router instance for chaining', () => {
      const router = new DynamoDBStreamRouter();

      const result = router.insert({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('only matches INSERT records', ({ dynamoDBInsertRecord }) => {
      const router = createDynamoDBStreamRouter();
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
      const router = new DynamoDBStreamRouter();

      const result = router.modify({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('only matches MODIFY records', ({ dynamoDBModifyRecord }) => {
      const router = createDynamoDBStreamRouter();
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
      const router = new DynamoDBStreamRouter();

      const result = router.remove({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('only matches REMOVE records', ({ dynamoDBRemoveRecord }) => {
      const router = createDynamoDBStreamRouter();
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
    let router: DynamoDBStreamRouter;

    beforeEach(() => {
      router = createDynamoDBStreamRouter();
    });

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

    test('skips eventSourceArns filter when record has no ARN', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: {
            eventSourceArns: ['arn:aws:dynamodb:us-east-1:123456789012:table/my-table/stream/2024-01-01T00:00:00.000'],
          },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord({ eventSourceARN: undefined });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', 'NEW_AND_OLD_IMAGES');

      expect(result).toBeDefined();
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

    test('skips streamViewTypes filter when streamViewType is undefined', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: { streamViewTypes: ['NEW_AND_OLD_IMAGES'] },
        }).handle(async () => {}),
      );

      const record = dynamoDBInsertRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'INSERT', undefined);

      expect(result).toBeDefined();
    });

    test('matches route by customFilter', ({ dynamoDBInsertRecord }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ eventName }: DynamoDBStreamFilterInput): boolean => {
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

    test('customFilter receives correct DynamoDBStreamFilterInput', ({ dynamoDBInsertRecord }) => {
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
      // @ts-expect-error - result is asserted as defined above
      expect(result.handler).toBe(firstHandler);
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
      const router = new DynamoDBStreamRouter();
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
      const router = createDynamoDBStreamRouter();
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
      const router = createDynamoDBStreamRouter();
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
      const router = createDynamoDBStreamRouter();

      const { event, context } = dynamoDBStreamHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler errors', async ({ dynamoDBStreamHandlerEvent }) => {
      const router = createDynamoDBStreamRouter();
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
      const router = createDynamoDBStreamRouter();
      router.insert({ filters: {}, handler: async () => {} });

      const { event, context } = dynamoDBStreamHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('processes records sequentially', async ({ dynamoDBInsertRecord, dynamoDBStreamEvent, context }) => {
      const router = createDynamoDBStreamRouter();
      const callOrder: string[] = [];

      router.insert({
        filters: {},
        handler: async (request: DynamoDBStreamInsertRequest) => {
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
    test('returns undefined when all records succeed', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const router = createDynamoDBStreamRouter({ batchItemFailures: true });
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
      const router = createDynamoDBStreamRouter({ batchItemFailures: true });
      const failingRecord = dynamoDBInsertRecord();

      router.insert({
        filters: {},
        handler: async (request: DynamoDBStreamInsertRequest) => {
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
      const router = createDynamoDBStreamRouter({ batchItemFailures: true });
      const recordA = dynamoDBInsertRecord();
      const failingRecord = dynamoDBInsertRecord();
      const recordC = dynamoDBInsertRecord();
      const recordD = dynamoDBInsertRecord();

      router.insert({
        filters: {},
        handler: async (request: DynamoDBStreamInsertRequest) => {
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
      const router = createDynamoDBStreamRouter({ batchItemFailures: true });

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
      const router = createDynamoDBStreamRouter({ batchItemFailures: true });
      const handler = vi.fn();
      const failingRecord = dynamoDBInsertRecord();

      handler.mockImplementation(async (request: DynamoDBStreamInsertRequest) => {
        if (request.record.eventID === failingRecord.eventID) {
          throw new Error('processing failed');
        }
      });

      router.insert({ filters: {}, handler });

      const recordA = dynamoDBInsertRecord();
      const recordC = dynamoDBInsertRecord();
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
      const router = createDynamoDBStreamRouter({ batchItemFailures: true });

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
      const router = createDynamoDBStreamRouter({ batchItemFailures: true });
      const lastRecord = dynamoDBInsertRecord();

      router.insert({
        filters: {},
        handler: async (request: DynamoDBStreamInsertRequest) => {
          if (request.record.eventID === lastRecord.eventID) {
            throw new Error('last record failed');
          }
        },
      });

      const recordA = dynamoDBInsertRecord();
      const recordB = dynamoDBInsertRecord();
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
      const router = createDynamoDBStreamRouter();
      const handler = vi.fn();
      const transformedKeys = { pk: 'pk-123', sk: 'sk-123', validated: true };
      const keysSchema: Schema<typeof transformedKeys> = {
        safeParse: () => ({ success: true, data: transformedKeys }),
      };

      router.insert({ filters: {}, keysSchema, handler });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ keys: transformedKeys }));
    });

    test('throws when keysSchema validation fails and batchItemFailures is disabled', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const router = createDynamoDBStreamRouter();
      const keysSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      router.insert({ filters: {}, keysSchema, handler: async () => {} });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      await expect(router.handleEvent(event, context())).rejects.toThrow('Keys validation failed');
    });

    test('returns batchItemFailure when keysSchema validation fails', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const router = createDynamoDBStreamRouter({ batchItemFailures: true });
      const keysSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

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
      const router = createDynamoDBStreamRouter();
      const handler = vi.fn();
      const transformedImage = { pk: 'pk-123', sk: 'sk-123', name: 'Test Item', validated: true };
      const newImageSchema: Schema<typeof transformedImage> = {
        safeParse: () => ({ success: true, data: transformedImage }),
      };

      router.insert({ filters: {}, newImageSchema, handler });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ newImage: transformedImage }));
    });

    test('throws when newImageSchema validation fails and batchItemFailures is disabled', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const router = createDynamoDBStreamRouter();
      const newImageSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      router.insert({ filters: {}, newImageSchema, handler: async () => {} });

      const record = dynamoDBInsertRecord();
      const event = dynamoDBStreamEvent([record]);
      await expect(router.handleEvent(event, context())).rejects.toThrow('NewImage validation failed');
    });

    test('returns batchItemFailure when newImageSchema validation fails', async ({
      dynamoDBInsertRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const router = createDynamoDBStreamRouter({ batchItemFailures: true });
      const newImageSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

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
      const router = createDynamoDBStreamRouter();
      const handler = vi.fn();
      const transformedOldImage = { pk: 'pk-123', sk: 'sk-123', name: 'Old Item', validated: true };
      const oldImageSchema: Schema<typeof transformedOldImage> = {
        safeParse: () => ({ success: true, data: transformedOldImage }),
      };

      router.modify({ filters: {}, oldImageSchema, handler });

      const record = dynamoDBModifyRecord();
      const event = dynamoDBStreamEvent([record]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ oldImage: transformedOldImage }));
    });

    test('throws when oldImageSchema validation fails and batchItemFailures is disabled', async ({
      dynamoDBModifyRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const router = createDynamoDBStreamRouter();
      const oldImageSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      router.modify({ filters: {}, oldImageSchema, handler: async () => {} });

      const record = dynamoDBModifyRecord();
      const event = dynamoDBStreamEvent([record]);
      await expect(router.handleEvent(event, context())).rejects.toThrow('OldImage validation failed');
    });

    test('returns batchItemFailure when oldImageSchema validation fails', async ({
      dynamoDBModifyRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const router = createDynamoDBStreamRouter({ batchItemFailures: true });
      const oldImageSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      router.modify({ filters: {}, oldImageSchema, handler: async () => {} });

      const record = dynamoDBModifyRecord();
      const event = dynamoDBStreamEvent([record]);
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: record.eventID }],
      });
    });

    test('skips newImage validation when data is undefined on REMOVE', async ({
      dynamoDBRemoveRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const router = createDynamoDBStreamRouter();
      const handler = vi.fn();
      const safeParseSpy = vi.fn(() => ({ success: false as const, error: new Error('should not be called') }));

      router.route({
        filters: { eventNames: ['REMOVE'] },
        newImageSchema: { safeParse: safeParseSpy },
        handler,
      });

      const record = dynamoDBRemoveRecord();
      const event = dynamoDBStreamEvent([record]);
      await router.handleEvent(event, context());

      expect(safeParseSpy).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });
  });

  suite('validateImage', () => {
    let router: DynamoDBStreamRouter;

    beforeEach(() => {
      router = new DynamoDBStreamRouter();
    });

    test('returns validated data on success', () => {
      const data = { pk: 'pk-123', sk: 'sk-123' };
      const transformedData = { pk: 'pk-123', sk: 'sk-123', validated: true };
      const schema: Schema<typeof transformedData> = {
        safeParse: () => ({ success: true, data: transformedData }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateImage(data, schema, 'Keys', 'event-1');

      expect(result).toEqual(transformedData);
    });

    test('throws with imageName and recordId on failure', () => {
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateImage({ pk: 'test' }, schema, 'NewImage', 'event-42')).toThrow(
        'NewImage validation failed for record event-42',
      );
    });

    test('returns data unchanged when no schema is provided', () => {
      const data = { pk: 'pk-123', sk: 'sk-123' };

      // @ts-expect-error - testing private method directly
      const result = router.validateImage(data, undefined, 'Keys', 'event-1');

      expect(result).toBe(data);
    });

    test('returns undefined when data is undefined even with schema present', () => {
      const safeParseSpy = vi.fn(() => ({ success: false as const, error: new Error('should not be called') }));

      // @ts-expect-error - testing private method directly
      const result = router.validateImage(undefined, { safeParse: safeParseSpy }, 'NewImage', 'event-1');

      expect(result).toBeUndefined();
      expect(safeParseSpy).not.toHaveBeenCalled();
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

      const router = createDynamoDBStreamRouter();
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

      const router = createDynamoDBStreamRouter();
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

      const router = createDynamoDBStreamRouter();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = dynamoDBStreamEvent([dynamoDBInsertRecord(), dynamoDBModifyRecord(), dynamoDBRemoveRecord()]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });
});
