import { createDynamoDBStreamEvent, test } from '@lambda-event-router/testing';
import { createDynamoDBStreamRouter, DynamoDBStreamRouter, defineRoute } from './DynamoDBStreamRouter.js';
import type { DynamoDBStreamInsertRequest, DynamoDBStreamModifyRequest, DynamoDBStreamRequest } from './types.js';

describe('DynamoDBStreamRouter', () => {
  describe('createDynamoDBStreamRouter', () => {
    it('creates a DynamoDBStreamRouter instance', () => {
      const router = createDynamoDBStreamRouter();
      expect(router).toBeInstanceOf(DynamoDBStreamRouter);
    });
  });

  describe('canHandleEvent', () => {
    it('returns true for a valid DynamoDB stream event', () => {
      const router = new DynamoDBStreamRouter();
      const event = createDynamoDBStreamEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    it('returns false for a non-DynamoDB event', () => {
      const router = new DynamoDBStreamRouter();
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });
  });

  describe('route', () => {
    it('returns the router instance for chaining', () => {
      const router = new DynamoDBStreamRouter();
      const definition = defineRoute({
        filters: { eventNames: ['INSERT'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  describe('insert', () => {
    it('returns the router instance for chaining', () => {
      const router = new DynamoDBStreamRouter();

      const result = router.insert({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });
  });

  describe('modify', () => {
    it('returns the router instance for chaining', () => {
      const router = new DynamoDBStreamRouter();

      const result = router.modify({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });
  });

  describe('remove', () => {
    it('returns the router instance for chaining', () => {
      const router = new DynamoDBStreamRouter();

      const result = router.remove({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });
  });

  describe('handleEvent', () => {
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
  });

  describe('defineRoute', () => {
    it('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { eventNames: ['INSERT'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });
  });

  describe('full event processing', () => {
    test('routes DynamoDB stream events through insert and modify handlers', async ({
      dynamoDBInsertRecord,
      dynamoDBModifyRecord,
      dynamoDBStreamEvent,
      context,
    }) => {
      const receivedInsertRequests: DynamoDBStreamRequest[] = [];
      const receivedModifyRequests: DynamoDBStreamRequest[] = [];

      const router = createDynamoDBStreamRouter();
      router.insert({
        filters: {},
        handler: async (request: DynamoDBStreamInsertRequest) => {
          receivedInsertRequests.push(request);
        },
      });
      router.modify({
        filters: {},
        handler: async (request: DynamoDBStreamModifyRequest) => {
          receivedModifyRequests.push(request);
        },
      });

      const insertRecord = dynamoDBInsertRecord({
        keys: { pk: 'user-1', sk: 'profile' },
        newImage: { pk: 'user-1', sk: 'profile', name: 'Alice' },
      });
      const modifyRecord = dynamoDBModifyRecord({
        keys: { pk: 'user-2', sk: 'profile' },
        newImage: { pk: 'user-2', sk: 'profile', name: 'Bob Updated' },
        oldImage: { pk: 'user-2', sk: 'profile', name: 'Bob' },
      });

      const event = dynamoDBStreamEvent([insertRecord, modifyRecord]);
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(receivedInsertRequests).toHaveLength(1);
      expect(receivedInsertRequests[0]).toEqual(
        expect.objectContaining({
          keys: { pk: 'user-1', sk: 'profile' },
          newImage: { pk: 'user-1', sk: 'profile', name: 'Alice' },
          eventName: 'INSERT',
          context: mockContext,
        }),
      );

      expect(receivedModifyRequests).toHaveLength(1);
      expect(receivedModifyRequests[0]).toEqual(
        expect.objectContaining({
          keys: { pk: 'user-2', sk: 'profile' },
          newImage: { pk: 'user-2', sk: 'profile', name: 'Bob Updated' },
          oldImage: { pk: 'user-2', sk: 'profile', name: 'Bob' },
          eventName: 'MODIFY',
          context: mockContext,
        }),
      );
    });
  });
});
