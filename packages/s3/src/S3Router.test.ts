import { createS3Event, createS3Record, test } from '@lambda-event-router/testing';
import { createS3Router, defineRoute, S3Router } from './S3Router.js';
import type { S3ObjectCreatedRequest } from './types/index.js';

describe('S3Router', () => {
  describe('createS3Router', () => {
    it('creates an S3Router instance', () => {
      const router = createS3Router();
      expect(router).toBeInstanceOf(S3Router);
    });
  });

  describe('canHandleEvent', () => {
    it('returns true for a valid S3 event', () => {
      const router = new S3Router();
      const event = createS3Event();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    it('returns false for a non-S3 event', () => {
      const router = new S3Router();
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });
  });

  describe('route', () => {
    it('returns the router instance for chaining', () => {
      const router = new S3Router();
      const definition = defineRoute({
        filters: { eventNames: ['s3:ObjectCreated:Put'], buckets: ['my-bucket'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  describe('objectCreatedPut', () => {
    it('returns the router instance for chaining', () => {
      const router = new S3Router();

      const result = router.objectCreatedPut({
        filters: { buckets: ['my-bucket'] },
        handler: async () => {},
      });

      expect(result).toBe(router);
    });
  });

  describe('batchOperation', () => {
    it('returns the router instance for chaining', () => {
      const router = new S3Router();

      const result = router.batchOperation({
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  describe('handleEvent', () => {
    test('calls the matched handler with the parsed request', async ({ s3HandlerEvent }) => {
      const router = new S3Router();
      const handler = vi.fn();
      router.objectCreatedPut({
        filters: { buckets: ['my-bucket'] },
        handler,
      });

      const { event, context } = s3HandlerEvent({ records: [createS3Record({ eventName: 's3:ObjectCreated:Put' })] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: 'my-bucket',
          key: 'uploads/test-file.txt',
          eventName: 's3:ObjectCreated:Put',
          record: event.Records[0],
          context,
        }),
      );
    });
  });

  describe('defineRoute', () => {
    it('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { eventNames: ['s3:ObjectCreated:Put'], buckets: ['my-bucket'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });
  });

  describe('full event processing', () => {
    test('routes S3 events through handlers based on bucket filters', async ({ s3Record, s3Event, context }) => {
      const receivedBucketARequests: S3ObjectCreatedRequest[] = [];
      const receivedBucketBRequests: S3ObjectCreatedRequest[] = [];

      const router = createS3Router();
      router.objectCreatedPut({
        filters: { buckets: ['bucket-a'] },
        handler: async (request: S3ObjectCreatedRequest) => {
          receivedBucketARequests.push(request);
        },
      });
      router.objectCreatedPut({
        filters: { buckets: ['bucket-b'] },
        handler: async (request: S3ObjectCreatedRequest) => {
          receivedBucketBRequests.push(request);
        },
      });

      const records = [
        s3Record({
          eventName: 's3:ObjectCreated:Put',
          s3: { bucket: { name: 'bucket-a' }, object: { key: 'file-a.txt', size: 100, eTag: 'etag-a' } },
        }),
        s3Record({
          eventName: 's3:ObjectCreated:Put',
          s3: { bucket: { name: 'bucket-b' }, object: { key: 'file-b.txt', size: 200, eTag: 'etag-b' } },
        }),
      ];
      const event = s3Event(records);
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(receivedBucketARequests).toHaveLength(1);
      expect(receivedBucketARequests[0]).toEqual(
        expect.objectContaining({
          bucket: 'bucket-a',
          key: 'file-a.txt',
          objectSize: 100,
          eTag: 'etag-a',
          context: mockContext,
        }),
      );

      expect(receivedBucketBRequests).toHaveLength(1);
      expect(receivedBucketBRequests[0]).toEqual(
        expect.objectContaining({
          bucket: 'bucket-b',
          key: 'file-b.txt',
          objectSize: 200,
          eTag: 'etag-b',
          context: mockContext,
        }),
      );
    });
  });
});
