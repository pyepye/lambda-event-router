import { createS3BatchEvent, createS3BatchTask, createS3Event, test } from '@lambda-event-router/testing';
import { createS3Router, defineRoute, S3Router } from './S3Router.js';
import type { S3FilterInput } from './types/index.js';

suite('S3Router', () => {
  suite('createS3Router', () => {
    test('creates an S3Router instance', () => {
      const router = createS3Router();
      expect(router).toBeInstanceOf(S3Router);
    });
  });

  suite('canHandleEvent', () => {
    let router: S3Router;

    beforeEach(() => {
      router = new S3Router();
    });

    test('returns true for a valid S3 event', () => {
      const event = createS3Event();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for a valid S3 Batch event', () => {
      const event = createS3BatchEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for a non-S3 event', () => {
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

    test('returns false when eventSource is not aws:s3', () => {
      expect(router.canHandleEvent({ Records: [{ eventSource: 'aws:sqs' }] })).toBe(false);
    });

    test('returns false for batch event missing invocationSchemaVersion', () => {
      expect(
        router.canHandleEvent({
          invocationId: 'test',
          job: { id: 'test' },
          tasks: [],
        }),
      ).toBe(false);
    });

    test('returns false for batch event missing tasks array', () => {
      expect(
        router.canHandleEvent({
          invocationSchemaVersion: '1.0',
          invocationId: 'test',
          job: { id: 'test' },
        }),
      ).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { buckets: ['my-bucket'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters and handler in the definition', () => {
      const handler = vi.fn();
      const filters = { buckets: ['my-bucket'], prefixes: ['uploads/'] };

      const definition = defineRoute({ filters }).handle(handler);

      expect(definition).toEqual({ filters, handler });
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const router = new S3Router();
      const definition = defineRoute({
        filters: { buckets: ['my-bucket'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('batchOperation', () => {
    test('returns the router instance for chaining', () => {
      const router = new S3Router();

      const result = router.batchOperation({
        handler: async () => ({
          invocationSchemaVersion: '1.0',
          treatMissingKeysAs: 'PermanentFailure' as const,
          invocationId: 'test',
          results: [],
        }),
      });

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    let router: S3Router;

    beforeEach(() => {
      router = createS3Router();
    });

    test('matches route by exact eventName', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { eventNames: ['s3:ObjectCreated:Put'] },
        }).handle(async () => {}),
      );

      const record = s3Record({ eventName: 's3:ObjectCreated:Put' });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('matches route by wildcard eventName', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { eventNames: ['s3:ObjectCreated:*'] },
        }).handle(async () => {}),
      );

      const record = s3Record({ eventName: 's3:ObjectCreated:Put' });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match route when eventName does not match', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { eventNames: ['s3:ObjectRemoved:Delete'] },
        }).handle(async () => {}),
      );

      const record = s3Record({ eventName: 's3:ObjectCreated:Put' });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route by bucket name', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { buckets: ['my-bucket'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match route when bucket does not match', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { buckets: ['other-bucket'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route when key starts with any prefix', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { prefixes: ['images/', 'uploads/'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match route when key does not start with any prefix', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { prefixes: ['images/', 'docs/'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route when key ends with any suffix', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { suffixes: ['.jpg', '.txt'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match route when key does not end with any suffix', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { suffixes: ['.jpg', '.png'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route when key contains any substring', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { includes: ['archive', 'test'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test-file.txt', 's3:ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match route when key does not contain any substring', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { includes: ['archive', 'backup'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test-file.txt', 's3:ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ bucket, key }: S3FilterInput): boolean => {
              return bucket === 'my-bucket' && key.startsWith('uploads/');
            },
          },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('customFilter receives bucket, key, eventName, and record', ({ s3Record }) => {
      const filterFn = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: { customFilter: filterFn },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(filterFn).toHaveBeenCalledWith({
        bucket: 'my-bucket',
        key: 'uploads/test.txt',
        eventName: 's3:ObjectCreated:Put',
        record,
      });
    });

    test('matches when both bucket and prefix filters pass', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { buckets: ['my-bucket'], prefixes: ['uploads/'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match when bucket passes but prefix fails', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { buckets: ['my-bucket'], prefixes: ['images/'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches when bucket and customFilter both pass', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: {
            buckets: ['my-bucket'],
            customFilter: ({ key }: S3FilterInput): boolean => key.endsWith('.txt'),
          },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match when bucket passes but customFilter rejects', ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: {
            buckets: ['my-bucket'],
            customFilter: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route with empty filters as a catch-all', ({ s3Record }) => {
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'any-bucket', 'any/key.xyz', 's3:ObjectRemoved:Delete');

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', ({ s3Record }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.route(defineRoute({ filters: { buckets: ['my-bucket'] } }).handle(firstHandler));
      router.route(defineRoute({ filters: { buckets: ['my-bucket'] } }).handle(secondHandler));

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');

      expect(result).toBeDefined();
      // @ts-expect-error - result is asserted as defined above
      expect(result.handler).toBe(firstHandler);
    });
  });

  suite('matchEventName', () => {
    let router: S3Router;

    beforeEach(() => {
      router = new S3Router();
    });

    test('returns true for exact match', () => {
      // @ts-expect-error - testing private method directly
      const result = router.matchEventName('s3:ObjectCreated:Put', ['s3:ObjectCreated:Put']);
      expect(result).toBe(true);
    });

    test('returns true when wildcard matches', () => {
      // @ts-expect-error - testing private method directly
      const result = router.matchEventName('s3:ObjectCreated:Put', ['s3:ObjectCreated:*']);
      expect(result).toBe(true);
    });

    test('returns false when wildcard does not match different category', () => {
      // @ts-expect-error - testing private method directly
      const result = router.matchEventName('s3:ObjectRemoved:Delete', ['s3:ObjectCreated:*']);
      expect(result).toBe(false);
    });

    test('returns false when no filter matches', () => {
      // @ts-expect-error - testing private method directly
      const result = router.matchEventName('s3:ObjectCreated:Put', ['s3:ObjectRemoved:Delete']);
      expect(result).toBe(false);
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with built request for ObjectCreated event', async ({ s3Record, s3HandlerEvent }) => {
      const router = new S3Router();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventNames: ['s3:ObjectCreated:Put'] },
        }).handle(handler),
      );

      const record = s3Record({ eventName: 's3:ObjectCreated:Put' });
      const { event, context } = s3HandlerEvent({ records: [record] });
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

    test('processes records sequentially', async ({ s3Record, s3HandlerEvent }) => {
      const router = new S3Router();
      const callOrder: string[] = [];

      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          callOrder.push(`start-${request.key}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${request.key}`);
        }),
      );

      const recordA = s3Record({ s3: { object: { key: 'file-a.txt' } } });
      const recordB = s3Record({ s3: { object: { key: 'file-b.txt' } } });
      const { event, context } = s3HandlerEvent({ records: [recordA, recordB] });
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['start-file-a.txt', 'end-file-a.txt', 'start-file-b.txt', 'end-file-b.txt']);
    });

    test('routes S3 Batch event to batch handler', async ({ s3BatchHandlerEvent }) => {
      const router = new S3Router();
      const batchResult = {
        invocationSchemaVersion: '1.0',
        treatMissingKeysAs: 'PermanentFailure' as const,
        invocationId: 'test',
        results: [{ taskId: 'task-1', resultCode: 'Succeeded' as const, resultString: 'ok' }],
      };
      router.batchOperation({ handler: async () => batchResult });

      const { event, context } = s3BatchHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(batchResult);
    });
  });

  suite('handleBatchEvent', () => {
    let router: S3Router;

    beforeEach(() => {
      router = new S3Router();
    });

    test('parses bucket name from ARN', async ({ s3BatchEvent, context }) => {
      const handler = vi.fn().mockResolvedValue({
        invocationSchemaVersion: '1.0',
        treatMissingKeysAs: 'PermanentFailure',
        invocationId: 'test',
        results: [],
      });
      router.batchOperation({ handler });

      const event = s3BatchEvent({
        tasks: [createS3BatchTask({ s3BucketArn: 'arn:aws:s3:::my-special-bucket' })],
      });

      // @ts-expect-error - testing private method directly
      await router.handleBatchEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'my-special-bucket' }));
    });

    test('URL-decodes key with + as space and percent encoding', async ({ s3BatchEvent, context }) => {
      const handler = vi.fn().mockResolvedValue({
        invocationSchemaVersion: '1.0',
        treatMissingKeysAs: 'PermanentFailure',
        invocationId: 'test',
        results: [],
      });
      router.batchOperation({ handler });

      const event = s3BatchEvent({
        tasks: [createS3BatchTask({ s3Key: 'uploads/my+file%20name.txt' })],
      });

      // @ts-expect-error - testing private method directly
      await router.handleBatchEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ key: 'uploads/my file name.txt' }));
    });

    test('builds request with taskId, bucket, key, versionId, task, event, and context', async ({
      s3BatchEvent,
      context,
    }) => {
      const handler = vi.fn().mockResolvedValue({
        invocationSchemaVersion: '1.0',
        treatMissingKeysAs: 'PermanentFailure',
        invocationId: 'test',
        results: [],
      });
      router.batchOperation({ handler });

      const task = createS3BatchTask({
        taskId: 'task-123',
        s3BucketArn: 'arn:aws:s3:::my-bucket',
        s3Key: 'uploads/test.txt',
        s3VersionId: 'v1',
      });
      const event = s3BatchEvent({ tasks: [task] });
      const ctx = context();

      // @ts-expect-error - testing private method directly
      await router.handleBatchEvent(event, ctx);

      expect(handler).toHaveBeenCalledWith({
        taskId: 'task-123',
        bucket: 'my-bucket',
        key: 'uploads/test.txt',
        versionId: 'v1',
        task,
        event,
        context: ctx,
      });
    });

    test('throws when no batch handler registered', async ({ s3BatchEvent, context }) => {
      const event = s3BatchEvent();

      // @ts-expect-error - testing private method directly
      await expect(router.handleBatchEvent(event, context())).rejects.toThrow('No batch operation handler registered');
    });

    test('returns handler result', async ({ s3BatchEvent, context }) => {
      const batchResult = {
        invocationSchemaVersion: '1.0',
        treatMissingKeysAs: 'PermanentFailure' as const,
        invocationId: 'test',
        results: [{ taskId: 'task-1', resultCode: 'Succeeded' as const, resultString: 'done' }],
      };
      router.batchOperation({ handler: async () => batchResult });

      const event = s3BatchEvent();

      // @ts-expect-error - testing private method directly
      const result = await router.handleBatchEvent(event, context());

      expect(result).toEqual(batchResult);
    });
  });

  suite('processRecord', () => {
    test('URL-decodes key from record', async ({ s3Record, context }) => {
      const router = new S3Router();
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const record = s3Record({ s3: { object: { key: 'uploads/my+file%20name.txt' } } });

      // @ts-expect-error - testing private method directly
      await router.processRecord(record, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ key: 'uploads/my file name.txt' }));
    });

    test('throws when no route matched', async ({ s3Record, context }) => {
      const router = new S3Router();
      const record = s3Record();

      // @ts-expect-error - testing private method directly
      await expect(router.processRecord(record, context())).rejects.toThrow(
        'No route matched for record from bucket my-bucket, key uploads/test-file.txt',
      );
    });
  });

  suite('buildRequest', () => {
    let router: S3Router;

    beforeEach(() => {
      router = new S3Router();
    });

    test('ObjectCreated events include objectSize and eTag', ({ s3Record, context }) => {
      const record = s3Record({
        eventName: 's3:ObjectCreated:Put',
        s3: { object: { size: 2048, eTag: 'abc123' } },
      });

      // @ts-expect-error - testing private method directly
      const result = router.buildRequest(record, context(), 'my-bucket', 'uploads/test.txt');

      expect(result).toEqual(expect.objectContaining({ objectSize: 2048, eTag: 'abc123' }));
    });

    test('ObjectRestore events include restoreEventData', ({ s3Record, context }) => {
      const restoreEventData = {
        lifecycleRestorationExpiryTime: '2024-01-15T00:00:00.000Z',
        lifecycleRestoreStorageClass: 'STANDARD',
      };
      const record = s3Record({
        eventName: 's3:ObjectRestore:Completed',
        glacierEventData: { restoreEventData },
      });

      // @ts-expect-error - testing private method directly
      const result = router.buildRequest(record, context(), 'my-bucket', 'uploads/test.txt');

      expect(result).toEqual(expect.objectContaining({ restoreEventData }));
    });

    test('other events return base request only', ({ s3Record, context }) => {
      const record = s3Record({ eventName: 's3:ObjectRemoved:Delete' });

      // @ts-expect-error - testing private method directly
      const result = router.buildRequest(record, context(), 'my-bucket', 'uploads/test.txt');

      expect(result).not.toHaveProperty('objectSize');
      expect(result).not.toHaveProperty('eTag');
      expect(result).not.toHaveProperty('restoreEventData');
    });

    test('all requests include bucket, key, eventName, eventTime, versionId, record, and context', ({
      s3Record,
      context,
    }) => {
      const record = s3Record({ eventName: 's3:ObjectRemoved:Delete' });
      const ctx = context();

      // @ts-expect-error - testing private method directly
      const result = router.buildRequest(record, ctx, 'my-bucket', 'uploads/test.txt');

      expect(result).toEqual(
        expect.objectContaining({
          bucket: 'my-bucket',
          key: 'uploads/test.txt',
          eventName: 's3:ObjectRemoved:Delete',
          eventTime: record.eventTime,
          versionId: record.s3.object.versionId,
          record,
          context: ctx,
        }),
      );
    });
  });

  suite('convenience methods', () => {
    test.each([
      { method: 'objectCreated', eventName: 's3:ObjectCreated:*' },
      { method: 'objectCreatedPut', eventName: 's3:ObjectCreated:Put' },
      { method: 'objectCreatedPost', eventName: 's3:ObjectCreated:Post' },
      { method: 'objectCreatedCopy', eventName: 's3:ObjectCreated:Copy' },
      { method: 'objectCreatedCompleteMultipartUpload', eventName: 's3:ObjectCreated:CompleteMultipartUpload' },
      { method: 'objectRemoved', eventName: 's3:ObjectRemoved:*' },
      { method: 'objectRemovedDelete', eventName: 's3:ObjectRemoved:Delete' },
      { method: 'objectRemovedDeleteMarkerCreated', eventName: 's3:ObjectRemoved:DeleteMarkerCreated' },
      { method: 'objectRestore', eventName: 's3:ObjectRestore:*' },
      { method: 'objectRestorePost', eventName: 's3:ObjectRestore:Post' },
      { method: 'objectRestoreCompleted', eventName: 's3:ObjectRestore:Completed' },
      { method: 'objectRestoreDelete', eventName: 's3:ObjectRestore:Delete' },
      { method: 'lifecycleExpiration', eventName: 's3:LifecycleExpiration:*' },
      { method: 'lifecycleExpirationDelete', eventName: 's3:LifecycleExpiration:Delete' },
      { method: 'lifecycleExpirationDeleteMarkerCreated', eventName: 's3:LifecycleExpiration:DeleteMarkerCreated' },
      { method: 'lifecycleTransition', eventName: 's3:LifecycleTransition' },
      { method: 'objectTagging', eventName: 's3:ObjectTagging:*' },
      { method: 'objectTaggingPut', eventName: 's3:ObjectTagging:Put' },
      { method: 'objectTaggingDelete', eventName: 's3:ObjectTagging:Delete' },
      { method: 'objectAclPut', eventName: 's3:ObjectAcl:Put' },
      { method: 'reducedRedundancyLostObject', eventName: 's3:ReducedRedundancyLostObject' },
      { method: 'intelligentTiering', eventName: 's3:IntelligentTiering' },
      { method: 'testEvent', eventName: 's3:TestEvent' },
    ])('$method sets eventName filter to $eventName', ({ method, eventName }) => {
      const router = new S3Router();
      const handler = vi.fn();
      // @ts-expect-error - dynamic method access for convenience method testing
      router[method]({ handler });

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({}, 'my-bucket', 'uploads/test.txt', eventName);

      expect(result).toBeDefined();
    });

    test('merges user-provided filters with auto-set eventName', ({ s3Record }) => {
      const router = new S3Router();
      const handler = vi.fn();
      router.objectCreatedPut({ filters: { buckets: ['specific-bucket'], prefixes: ['uploads/'] }, handler });

      const record = s3Record({ eventName: 's3:ObjectCreated:Put' });

      // @ts-expect-error - testing private method directly
      const matchingResult = router.matchRoute(record, 'specific-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');
      expect(matchingResult).toBeDefined();

      // @ts-expect-error - testing private method directly
      const nonMatchingResult = router.matchRoute(record, 'other-bucket', 'uploads/test.txt', 's3:ObjectCreated:Put');
      expect(nonMatchingResult).toBeUndefined();
    });
  });

  suite('full event processing', () => {
    test('routes records to different handlers based on event name filters', async ({ s3Record, s3HandlerEvent }) => {
      const createHandler = vi.fn();
      const deleteHandler = vi.fn();

      const router = createS3Router();
      router.objectCreated({ handler: createHandler });
      router.objectRemoved({ handler: deleteHandler });

      const records = [
        s3Record({ eventName: 's3:ObjectCreated:Put' }),
        s3Record({ eventName: 's3:ObjectCreated:Copy' }),
        s3Record({ eventName: 's3:ObjectRemoved:Delete' }),
      ];
      const { event, context } = s3HandlerEvent({ records });
      await router.handleEvent(event, context);

      expect(createHandler).toHaveBeenCalledTimes(2);
      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });

    test('routes records to different handlers based on bucket and prefix filters', async ({
      s3Record,
      s3HandlerEvent,
    }) => {
      const uploadsHandler = vi.fn();
      const imagesHandler = vi.fn();

      const router = createS3Router();
      router.route(
        defineRoute({
          filters: { buckets: ['my-bucket'], prefixes: ['uploads/'] },
        }).handle(uploadsHandler),
      );
      router.route(
        defineRoute({
          filters: { buckets: ['my-bucket'], prefixes: ['images/'] },
        }).handle(imagesHandler),
      );

      const records = [
        s3Record({ s3: { object: { key: 'uploads/file.txt' } } }),
        s3Record({ s3: { object: { key: 'images/photo.jpg' } } }),
        s3Record({ s3: { object: { key: 'uploads/doc.pdf' } } }),
      ];
      const { event, context } = s3HandlerEvent({ records });
      await router.handleEvent(event, context);

      expect(uploadsHandler).toHaveBeenCalledTimes(2);
      expect(imagesHandler).toHaveBeenCalledTimes(1);
    });
  });
});
