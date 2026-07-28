import { allEventBuilders, createS3BatchEvent, createS3Event, test } from '@lambda-event-router/testing';

import { createS3Router, defineRoute, S3Router } from './S3Router.js';
import type { S3BaseRequest, S3FilterInput, S3Filters } from './types/index.js';

type S3Next = (request: S3BaseRequest) => Promise<void>;

suite('S3Router', () => {
  let router: S3Router;

  beforeEach(() => {
    router = new S3Router();
  });

  suite('createS3Router', () => {
    test('creates an S3Router instance', () => {
      const router = createS3Router();
      expect(router).toBeInstanceOf(S3Router);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid S3 event', () => {
      const event = createS3Event();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for an S3 Batch event', () => {
      expect(router.canHandleEvent(createS3BatchEvent())).toBe(false);
    });

    test('returns true for an S3 test event', () => {
      const event = { Service: 'Amazon S3', Event: 's3:TestEvent', Bucket: 'my-bucket' };
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
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { bucket: 'my-bucket' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters and handler in the definition', () => {
      const handler = vi.fn();
      const filters = { bucket: 'my-bucket', prefix: 'uploads/' };

      const definition = defineRoute({ filters }).handle(handler);

      expect(definition).toEqual({ filters, handler });
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: { bucket: 'my-bucket' },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('testEvent', () => {
    const rawTestEvent = {
      Service: 'Amazon S3' as const,
      Event: 's3:TestEvent' as const,
      Time: '2024-01-01T00:00:00.000Z',
      Bucket: 'my-bucket',
      RequestId: 'REQ123',
      HostId: 'HOST123',
    };

    test('returns the router instance for chaining', () => {
      const result = router.testEvent({ handler: async () => {} });

      expect(result).toBe(router);
    });

    test('throws when a second test event route is registered', () => {
      router.testEvent({ handler: async () => {} });

      expect(() => router.testEvent({ handler: async () => {} })).toThrow('A test event route is already registered');
    });

    test('calls the registered handler with the mapped request', async ({ context }) => {
      const handler = vi.fn();
      router.testEvent({ handler });

      const ctx = context();
      await router.handleEvent(rawTestEvent, ctx);

      expect(handler).toHaveBeenCalledWith({
        bucket: 'my-bucket',
        time: '2024-01-01T00:00:00.000Z',
        requestId: 'REQ123',
        hostId: 'HOST123',
        context: ctx,
      });
    });

    test('returns undefined without a registered handler and does not throw', async ({ context }) => {
      const result = await router.handleEvent(rawTestEvent, context());

      expect(result).toBeUndefined();
    });

    test('does not run notification routes for a test event', async ({ context }) => {
      const notificationHandler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(notificationHandler));
      const testHandler = vi.fn();
      router.testEvent({ handler: testHandler });

      await router.handleEvent(rawTestEvent, context());

      expect(notificationHandler).not.toHaveBeenCalled();
      expect(testHandler).toHaveBeenCalledOnce();
    });
  });

  suite('convenience methods', () => {
    test.each([
      { method: 'objectCreated', eventName: 'ObjectCreated:*' },
      { method: 'objectCreatedPut', eventName: 'ObjectCreated:Put' },
      { method: 'objectCreatedPost', eventName: 'ObjectCreated:Post' },
      { method: 'objectCreatedCopy', eventName: 'ObjectCreated:Copy' },
      { method: 'objectCreatedCompleteMultipartUpload', eventName: 'ObjectCreated:CompleteMultipartUpload' },
      { method: 'objectRemoved', eventName: 'ObjectRemoved:*' },
      { method: 'objectRemovedDelete', eventName: 'ObjectRemoved:Delete' },
      { method: 'objectRemovedDeleteMarkerCreated', eventName: 'ObjectRemoved:DeleteMarkerCreated' },
      { method: 'objectRestore', eventName: 'ObjectRestore:*' },
      { method: 'objectRestorePost', eventName: 'ObjectRestore:Post' },
      { method: 'objectRestoreCompleted', eventName: 'ObjectRestore:Completed' },
      { method: 'objectRestoreDelete', eventName: 'ObjectRestore:Delete' },
      { method: 'lifecycleExpiration', eventName: 'LifecycleExpiration:*' },
      { method: 'lifecycleExpirationDelete', eventName: 'LifecycleExpiration:Delete' },
      { method: 'lifecycleExpirationDeleteMarkerCreated', eventName: 'LifecycleExpiration:DeleteMarkerCreated' },
      { method: 'lifecycleTransition', eventName: 'LifecycleTransition' },
      { method: 'objectTagging', eventName: 'ObjectTagging:*' },
      { method: 'objectTaggingPut', eventName: 'ObjectTagging:Put' },
      { method: 'objectTaggingDelete', eventName: 'ObjectTagging:Delete' },
      { method: 'objectAclPut', eventName: 'ObjectAcl:Put' },
      { method: 'reducedRedundancyLostObject', eventName: 'ReducedRedundancyLostObject' },
      { method: 'intelligentTiering', eventName: 'IntelligentTiering' },
    ])('$method sets eventName filter to $eventName', async ({ method, eventName }) => {
      const handler = vi.fn();
      // @ts-expect-error - dynamic method access for convenience method testing
      router[method]({ handler });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({}, 'my-bucket', 'uploads/test.txt', eventName);

      expect(result).toBeDefined();
    });

    test('merges user-provided filters with auto-set eventName', async ({ s3Record }) => {
      const handler = vi.fn();
      router.objectCreatedPut({ filters: { bucket: 'specific-bucket', key: 'uploads/*' }, handler });

      const record = s3Record({ eventName: 'ObjectCreated:Put' });
      // @ts-expect-error - testing private method directly
      const matchingResult = await router.matchRoute(
        record,
        'specific-bucket',
        'uploads/test.txt',
        'ObjectCreated:Put',
      );
      expect(matchingResult).toBeDefined();

      // @ts-expect-error - testing private method directly
      const nonMatchingResult = await router.matchRoute(
        record,
        'other-bucket',
        'uploads/test.txt',
        'ObjectCreated:Put',
      );
      expect(nonMatchingResult).toBeUndefined();
    });
  });

  suite('matchRoute', () => {
    test('matches route by exact eventName', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { eventName: 'ObjectCreated:Put' },
        }).handle(async () => {}),
      );

      const record = s3Record({ eventName: 'ObjectCreated:Put' });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('matches route by exact eventName array', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { eventName: ['ObjectCreated:Put', 'ObjectCreated:Copy'] },
        }).handle(async () => {}),
      );

      const record = s3Record({ eventName: 'ObjectCreated:Put' });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('matches route by wildcard eventName', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { eventName: 'ObjectCreated:*' },
        }).handle(async () => {}),
      );

      const record = s3Record({ eventName: 'ObjectCreated:Put' });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match route when eventName does not match', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { eventName: 'ObjectRemoved:Delete' },
        }).handle(async () => {}),
      );

      const record = s3Record({ eventName: 'ObjectCreated:Put' });
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route by bucket name', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { bucket: 'my-bucket' },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match when bucket is an empty string', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { bucket: '' },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route by bucket name array', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { bucket: ['my-bucket', 'other-bucket'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match route when bucket does not match', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { bucket: 'other-bucket' },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route when key contains substring', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { key: '*test*' },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test-file.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('matches route when key contains substring array', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { key: ['*archive*', '*test*'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test-file.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match route when key does not contain any substring', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { key: ['*archive*', '*backup*'] },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test-file.txt', 'ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route by custom', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: {
            custom: ({ bucket, key }: S3FilterInput): boolean => {
              return bucket === 'my-bucket' && key.startsWith('uploads/');
            },
          },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match route when custom returns false', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { custom: (): boolean => false },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route by async custom', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: {
            custom: async ({ bucket, key }: S3FilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              return bucket === 'my-bucket' && key.startsWith('uploads/');
            },
          },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('custom receives bucket, key, eventName, and record', async ({ s3Record }) => {
      const filterFn = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: { custom: filterFn },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(filterFn).toHaveBeenCalledWith({
        bucket: 'my-bucket',
        key: 'uploads/test.txt',
        eventName: 'ObjectCreated:Put',
        record,
      });
    });

    test('matches when both bucket and wildcard filters pass', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { bucket: 'my-bucket', key: 'uploads/*' },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match when bucket passes but key wildcard fails', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: { bucket: 'my-bucket', key: 'images/*' },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches when bucket and custom both pass', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: {
            bucket: 'my-bucket',
            custom: ({ key }: S3FilterInput): boolean => key.endsWith('.txt'),
          },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
    });

    test('does not match when bucket passes but custom rejects', async ({ s3Record }) => {
      router.route(
        defineRoute({
          filters: {
            bucket: 'my-bucket',
            custom: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeUndefined();
    });

    test('matches route with empty filters as a catch-all', async ({ s3Record }) => {
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'any-bucket', 'any/key.xyz', 'ObjectRemoved:Delete');

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', async ({ s3Record }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(defineRoute({ filters: { bucket: 'my-bucket' } }).handle(firstHandler));
      router.route(defineRoute({ filters: { bucket: 'my-bucket' } }).handle(secondHandler));

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('orders a narrower route ahead of a broader one registered first', async ({ s3Record }) => {
      const broad = vi.fn();
      const narrow = vi.fn();
      router.route(defineRoute({ filters: { bucket: 'my-bucket' } }).handle(broad));
      router.route(defineRoute({ filters: { bucket: 'my-bucket', key: 'uploads/*' } }).handle(narrow));

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result?.handler).toBe(narrow);
    });

    test('orders an exact key ahead of the wildcard that covers it', async ({ s3Record }) => {
      const wildcard = vi.fn();
      const exact = vi.fn();
      router.route(defineRoute({ filters: { bucket: 'my-bucket', key: 'uploads/*' } }).handle(wildcard));
      router.route(defineRoute({ filters: { bucket: 'my-bucket', key: 'uploads/test.txt' } }).handle(exact));

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result?.handler).toBe(exact);
    });

    test('orders a guarded route ahead of the fallback it shares filters with', async ({ s3Record }) => {
      const fallback = vi.fn();
      const guarded = vi.fn();
      router.route(defineRoute({ filters: { bucket: 'my-bucket' } }).handle(fallback));
      router.route(defineRoute({ filters: { bucket: 'my-bucket', custom: () => true } }).handle(guarded));

      const record = s3Record();
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(record, 'my-bucket', 'uploads/test.txt', 'ObjectCreated:Put');

      expect(result?.handler).toBe(guarded);
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with built request for ObjectCreated event', async ({ s3Record, s3HandlerEvent }) => {
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { eventName: 'ObjectCreated:Put' },
        }).handle(handler),
      );

      const record = s3Record({ eventName: 'ObjectCreated:Put' });
      const { event, context } = s3HandlerEvent({ records: [record] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: 'my-bucket',
          key: 'uploads/test-file.txt',
          eventName: 'ObjectCreated:Put',
          record: event.Records[0],
          context,
        }),
      );
    });

    test('processes records sequentially', async ({ s3Record, s3HandlerEvent }) => {
      const callOrder: string[] = [];

      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          callOrder.push(`start-${request.key}`);
          await new Promise((resolve) => setTimeout(resolve, 1));
          callOrder.push(`end-${request.key}`);
        }),
      );

      const recordA = s3Record({ s3: { object: { key: 'file-a.txt' } } });
      const recordB = s3Record({ s3: { object: { key: 'file-b.txt' } } });
      const { event, context } = s3HandlerEvent({ records: [recordA, recordB] });
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['start-file-a.txt', 'end-file-a.txt', 'start-file-b.txt', 'end-file-b.txt']);
    });
  });

  suite('processRecord', () => {
    test('URL-decodes key from record', async ({ s3Record, context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const record = s3Record({ s3: { object: { key: 'uploads/my+file%20name.txt' } } });
      // @ts-expect-error - testing private method directly
      await router.processRecord(record, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ key: 'uploads/my file name.txt' }));
    });

    test('throws when no route matched', async ({ s3Record, context }) => {
      const record = s3Record();

      // @ts-expect-error - testing private method directly
      await expect(router.processRecord(record, context())).rejects.toThrow(
        'No route matched for record from bucket my-bucket, key uploads/test-file.txt',
      );
    });
  });

  suite('buildRequest', () => {
    test('ObjectCreated events include objectSize and eTag', ({ s3Record, context }) => {
      const record = s3Record({
        eventName: 'ObjectCreated:Put',
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
        eventName: 'ObjectRestore:Completed',
        glacierEventData: { restoreEventData },
      });
      // @ts-expect-error - testing private method directly
      const result = router.buildRequest(record, context(), 'my-bucket', 'uploads/test.txt');

      expect(result).toEqual(expect.objectContaining({ restoreEventData }));
    });

    test('other events return base request only', ({ s3Record, context }) => {
      const record = s3Record({ eventName: 'ObjectRemoved:Delete' });
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
      const record = s3Record({ eventName: 'ObjectRemoved:Delete' });
      const ctx = context();
      // @ts-expect-error - testing private method directly
      const result = router.buildRequest(record, ctx, 'my-bucket', 'uploads/test.txt');

      expect(result).toEqual(
        expect.objectContaining({
          bucket: 'my-bucket',
          key: 'uploads/test.txt',
          eventName: 'ObjectRemoved:Delete',
          eventTime: record.eventTime,
          versionId: record.s3.object.versionId,
          record,
          context: ctx,
        }),
      );
    });
  });

  suite('full event processing', () => {
    test('routes records to different handlers based on event name filters', async ({ s3Record, s3HandlerEvent }) => {
      const createHandler = vi.fn();
      const deleteHandler = vi.fn();
      router.objectCreated({ handler: createHandler });
      router.objectRemoved({ handler: deleteHandler });

      const records = [
        s3Record({ eventName: 'ObjectCreated:Put' }),
        s3Record({ eventName: 'ObjectCreated:Copy' }),
        s3Record({ eventName: 'ObjectRemoved:Delete' }),
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
      router.route(
        defineRoute({
          filters: { bucket: 'my-bucket', key: 'uploads/*' },
        }).handle(uploadsHandler),
      );
      router.route(
        defineRoute({
          filters: { bucket: 'my-bucket', key: 'images/*' },
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

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ s3HandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: S3BaseRequest, next: S3Next): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createS3Router({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = s3HandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ s3HandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: S3BaseRequest, _next: S3Next): Promise<void> {
        return;
      }

      const router = createS3Router({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = s3HandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ s3HandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: S3BaseRequest, next: S3Next): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: S3BaseRequest, next: S3Next): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createS3Router({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = s3HandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ s3HandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: S3BaseRequest, next: S3Next): Promise<void> {
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

      const { event, context } = s3HandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ s3HandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: S3BaseRequest, _next: S3Next): Promise<void> {
        return;
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = s3HandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ s3HandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: S3BaseRequest, next: S3Next): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: S3BaseRequest, next: S3Next): Promise<void> {
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

      const { event, context } = s3HandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ s3HandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: S3BaseRequest, next: S3Next): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });
      router.route(route);

      const { event, context } = s3HandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ s3HandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: S3BaseRequest, next: S3Next): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: S3BaseRequest, next: S3Next): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createS3Router({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = s3HandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({ s3HandlerEvent }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: S3BaseRequest, _next: S3Next): Promise<void> {
        return;
      }

      const router = createS3Router({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = s3HandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('eventName filter typing', () => {
    test('accepts a known event name', () => {
      const filters: S3Filters = { eventName: 'ObjectCreated:Put' };

      expect(filters.eventName).toBe('ObjectCreated:Put');
    });

    test('accepts the wildcard a family declares', () => {
      const filters: S3Filters = { eventName: ['ObjectCreated:*', 'ObjectRemoved:Delete'] };

      expect(filters.eventName).toEqual(['ObjectCreated:*', 'ObjectRemoved:Delete']);
    });

    test('rejects a misspelled event name', () => {
      // @ts-expect-error ObjectCreated:Putt is not an S3 event name
      const filters: S3Filters = { eventName: 'ObjectCreated:Putt' };

      expect(filters.eventName).toBe('ObjectCreated:Putt');
    });

    test('rejects a pattern S3 never sends', () => {
      // @ts-expect-error only the wildcards the event name families declare are matchable
      const filters: S3Filters = { eventName: 'Object*' };

      expect(filters.eventName).toBe('Object*');
    });
  });
});

suite('S3Router.canHandleEvent', () => {
  const ownEvents = ['createS3Event', 'createS3TestEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createS3Router().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
