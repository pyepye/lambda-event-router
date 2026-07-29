import {
  allEventBuilders,
  createS3BatchEvent,
  createS3BatchTask,
  createS3BatchV2Event,
  createS3BatchV2Task,
  test,
} from '@lambda-event-router/testing';

import type { S3BatchResponse } from './batchResponse.js';
import { createS3BatchRouter, S3BatchRouter } from './S3BatchRouter.js';
import type { S3BatchRequest } from './types/index.js';

type S3BatchNext = (request: S3BatchRequest) => Promise<S3BatchResponse>;

suite('S3BatchRouter', () => {
  let router: S3BatchRouter;

  beforeEach(() => {
    router = new S3BatchRouter();
  });

  suite('createS3BatchRouter', () => {
    test('creates an S3BatchRouter instance', () => {
      expect(createS3BatchRouter()).toBeInstanceOf(S3BatchRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for an S3 Batch event', () => {
      expect(router.canHandleEvent(createS3BatchEvent())).toBe(true);
    });

    test('returns true for a schema 2.0 batch event', () => {
      expect(router.canHandleEvent(createS3BatchV2Event())).toBe(true);
    });

    test('returns false for an S3 notification event', () => {
      expect(router.canHandleEvent({ Records: [{ eventSource: 'aws:s3' }] })).toBe(false);
    });

    test('returns false for an S3 test event', () => {
      expect(router.canHandleEvent({ Service: 'Amazon S3', Event: 's3:TestEvent', Bucket: 'my-bucket' })).toBe(false);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when invocationSchemaVersion is missing', () => {
      expect(router.canHandleEvent({ invocationId: 'test', job: { id: 'test' }, tasks: [] })).toBe(false);
    });

    test('returns false when invocationId is missing', () => {
      expect(router.canHandleEvent({ invocationSchemaVersion: '1.0', job: { id: 'test' }, tasks: [] })).toBe(false);
    });

    test('returns false when job is missing', () => {
      expect(router.canHandleEvent({ invocationSchemaVersion: '1.0', invocationId: 'test', tasks: [] })).toBe(false);
    });

    test('returns false when tasks is not an array', () => {
      expect(router.canHandleEvent({ invocationSchemaVersion: '1.0', invocationId: 'test', job: { id: 'test' } })).toBe(
        false,
      );
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const result = router.route({
        handler: async () => ({ resultCode: 'Succeeded' as const }),
      });

      expect(result).toBe(router);
    });

    test('throws when a second batch route is registered', () => {
      router.route({ handler: async () => ({ resultCode: 'Succeeded' as const }) });

      expect(() => router.route({ handler: async () => ({ resultCode: 'Succeeded' as const }) })).toThrow(
        'A batch route is already registered',
      );
    });
  });

  suite('handleEvent', () => {
    test('parses bucket name from ARN', async ({ s3BatchEvent, context }) => {
      const handler = vi.fn().mockResolvedValue({ resultCode: 'Succeeded' });
      router.route({ handler });

      const event = s3BatchEvent({
        tasks: [createS3BatchTask({ s3BucketArn: 'arn:aws:s3:::my-special-bucket' })],
      });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'my-special-bucket' }));
    });

    test('parses bucket name from an ARN carrying a region and account', async ({ s3BatchEvent, context }) => {
      const handler = vi.fn().mockResolvedValue({ resultCode: 'Succeeded' });
      router.route({ handler });

      const event = s3BatchEvent({
        tasks: [createS3BatchTask({ s3BucketArn: 'arn:aws:s3:us-east-1:0123456788:amzn-s3-demo-bucket1' })],
      });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'amzn-s3-demo-bucket1' }));
    });

    test('URL-decodes key with + as space and percent encoding', async ({ s3BatchEvent, context }) => {
      const handler = vi.fn().mockResolvedValue({ resultCode: 'Succeeded' });
      router.route({ handler });

      const event = s3BatchEvent({
        tasks: [createS3BatchTask({ s3Key: 'uploads/my+file%20name.txt' })],
      });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ key: 'uploads/my file name.txt' }));
    });

    test('builds request with taskId, bucket, key, versionId, task, event, and context', async ({
      s3BatchEvent,
      context,
    }) => {
      const handler = vi.fn().mockResolvedValue({ resultCode: 'Succeeded' });
      router.route({ handler });

      const task = createS3BatchTask({
        taskId: 'task-123',
        s3BucketArn: 'arn:aws:s3:::my-bucket',
        s3Key: 'uploads/test.txt',
        s3VersionId: 'v1',
      });
      const event = s3BatchEvent({ tasks: [task] });
      const ctx = context();
      await router.handleEvent(event, ctx);

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
      await expect(router.handleEvent(event, context())).rejects.toThrow('No batch route registered');
    });

    test('wraps handler response into S3BatchResult envelope', async ({ s3BatchEvent, context }) => {
      router.route({ handler: async () => ({ resultCode: 'Succeeded' as const, resultString: 'done' }) });

      const event = s3BatchEvent();
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        invocationSchemaVersion: event.invocationSchemaVersion,
        treatMissingKeysAs: 'PermanentFailure',
        invocationId: event.invocationId,
        results: [{ taskId: event.tasks[0]?.taskId, resultCode: 'Succeeded', resultString: 'done' }],
      });
    });

    test('defaults treatMissingKeysAs to PermanentFailure when not set', async ({ s3BatchEvent, context }) => {
      router.route({ handler: async () => ({ resultCode: 'Succeeded' as const }) });

      const event = s3BatchEvent();
      const result = await router.handleEvent(event, context());

      expect(result.treatMissingKeysAs).toBe('PermanentFailure');
    });

    test('uses treatMissingKeysAs from the batch definition when set', async ({ s3BatchEvent, context }) => {
      router.route({
        treatMissingKeysAs: 'Succeeded',
        handler: async () => ({ resultCode: 'Succeeded' as const }),
      });

      const event = s3BatchEvent();
      const result = await router.handleEvent(event, context());

      expect(result.treatMissingKeysAs).toBe('Succeeded');
    });

    test('processes every task and returns one result per task', async ({ s3BatchEvent, context }) => {
      const processedKeys: string[] = [];
      router.route({
        handler: async (request: S3BatchRequest) => {
          processedKeys.push(request.key);
          return { resultCode: 'Succeeded' as const, resultString: `done ${request.key}` };
        },
      });

      const taskA = createS3BatchTask({ taskId: 'task-a', s3Key: 'a.txt' });
      const taskB = createS3BatchTask({ taskId: 'task-b', s3Key: 'b.txt' });
      const event = s3BatchEvent({ tasks: [taskA, taskB] });

      const result = await router.handleEvent(event, context());

      expect(processedKeys).toEqual(['a.txt', 'b.txt']);
      expect(result).toEqual({
        invocationSchemaVersion: event.invocationSchemaVersion,
        treatMissingKeysAs: 'PermanentFailure',
        invocationId: event.invocationId,
        results: [
          { taskId: 'task-a', resultCode: 'Succeeded', resultString: 'done a.txt' },
          { taskId: 'task-b', resultCode: 'Succeeded', resultString: 'done b.txt' },
        ],
      });
    });

    test('a per-task failure does not stop the other tasks', async ({ s3BatchEvent, context }) => {
      router.route({
        handler: async (request: S3BatchRequest) => {
          if (request.key === 'bad.txt') {
            throw { resultCode: 'PermanentFailure' as const, resultString: 'bad object' };
          }
          return { resultCode: 'Succeeded' as const, resultString: 'ok' };
        },
      });

      const taskA = createS3BatchTask({ taskId: 'task-a', s3Key: 'bad.txt' });
      const taskB = createS3BatchTask({ taskId: 'task-b', s3Key: 'good.txt' });
      const event = s3BatchEvent({ tasks: [taskA, taskB] });

      const result = await router.handleEvent(event, context());

      expect(result.results).toEqual([
        { taskId: 'task-a', resultCode: 'PermanentFailure', resultString: 'bad object' },
        { taskId: 'task-b', resultCode: 'Succeeded', resultString: 'ok' },
      ]);
    });

    test('rethrows non-S3BatchResponse errors', async ({ s3BatchEvent, context }) => {
      router.route({
        handler: async () => {
          throw new Error('something broke');
        },
      });

      const event = s3BatchEvent();
      await expect(router.handleEvent(event, context())).rejects.toThrow('something broke');
    });

    test('catches thrown S3BatchResponse and wraps into result', async ({ s3BatchEvent, context }) => {
      router.route({
        handler: async () => {
          throw { resultCode: 'PermanentFailure' as const, resultString: 'bad object' };
        },
      });

      const event = s3BatchEvent();
      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        invocationSchemaVersion: event.invocationSchemaVersion,
        treatMissingKeysAs: 'PermanentFailure',
        invocationId: event.invocationId,
        results: [{ taskId: event.tasks[0]?.taskId, resultCode: 'PermanentFailure', resultString: 'bad object' }],
      });
    });
  });

  suite('schema 2.0', () => {
    test('takes the bucket name from s3Bucket rather than an ARN', async ({ context }) => {
      const handler = vi.fn().mockResolvedValue({ resultCode: 'Succeeded' });
      router.route({ handler });
      const event = createS3BatchV2Event({ tasks: [createS3BatchV2Task({ s3Bucket: 'my-directory-bucket' })] });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'my-directory-bucket' }));
    });

    test('URL-decodes the key the same way as schema 1.0', async ({ context }) => {
      const handler = vi.fn().mockResolvedValue({ resultCode: 'Succeeded' });
      router.route({ handler });
      const event = createS3BatchV2Event({ tasks: [createS3BatchV2Task({ s3Key: 'probe/schema-2+probe.json' })] });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ key: 'probe/schema-2 probe.json' }));
    });

    test('hands the job userArguments to the handler', async ({ context }) => {
      const handler = vi.fn().mockResolvedValue({ resultCode: 'Succeeded' });
      router.route({ handler });
      const event = createS3BatchV2Event({ job: { id: 'job-1', userArguments: { mode: 'reindex' } } });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ userArguments: { mode: 'reindex' } }));
    });

    test('leaves userArguments undefined on a schema 1.0 event', async ({ context }) => {
      const handler = vi.fn().mockResolvedValue({ resultCode: 'Succeeded' });
      router.route({ handler });

      await router.handleEvent(createS3BatchEvent(), context());

      expect(handler.mock.calls[0]?.[0]).not.toHaveProperty('userArguments');
    });

    test('echoes the schema version back in the result', async ({ context }) => {
      router.route({ handler: async () => ({ resultCode: 'Succeeded' as const }) });

      const result = await router.handleEvent(createS3BatchV2Event(), context());

      expect(result.invocationSchemaVersion).toBe('2.0');
    });
  });

  suite('middleware', () => {
    test('executes middleware before the handler', async ({ s3BatchHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: S3BatchRequest, next: S3BatchNext): Promise<S3BatchResponse> {
        callOrder.push('mw-pre');
        const response = await next(request);
        callOrder.push('mw-post');
        return response;
      }
      router.route({
        middleware: [middleware],
        handler: async () => {
          callOrder.push('handler');
          return { resultCode: 'Succeeded' as const };
        },
      });

      const { event, context } = s3BatchHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip handler by not calling next', async ({ s3BatchHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue({ resultCode: 'Succeeded' as const });

      async function skipMiddleware(_request: S3BatchRequest, _next: S3BatchNext): Promise<S3BatchResponse> {
        return { resultCode: 'PermanentFailure' as const, resultString: 'skipped by middleware' };
      }
      router.route({
        middleware: [skipMiddleware],
        handler,
      });

      const { event, context } = s3BatchHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
      expect(result.results[0]?.resultCode).toBe('PermanentFailure');
      expect(result.results[0]?.resultString).toBe('skipped by middleware');
    });

    test('executes multiple middleware in order', async ({ s3BatchHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: S3BatchRequest, next: S3BatchNext): Promise<S3BatchResponse> {
        callOrder.push('mw1');
        return await next(request);
      }

      async function middlewareTwo(request: S3BatchRequest, next: S3BatchNext): Promise<S3BatchResponse> {
        callOrder.push('mw2');
        return await next(request);
      }
      router.route({
        middleware: [middlewareOne, middlewareTwo],
        handler: async () => {
          callOrder.push('handler');
          return { resultCode: 'Succeeded' as const };
        },
      });

      const { event, context } = s3BatchHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });

    test('middleware can modify the response', async ({ s3BatchHandlerEvent }) => {
      async function middleware(request: S3BatchRequest, next: S3BatchNext): Promise<S3BatchResponse> {
        const response = await next(request);
        return { ...response, resultString: 'modified by middleware' };
      }
      router.route({
        middleware: [middleware],
        handler: async () => ({ resultCode: 'Succeeded' as const, resultString: 'original' }),
      });

      const { event, context } = s3BatchHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result.results[0]?.resultString).toBe('modified by middleware');
    });

    test('executes router-level middleware before the handler', async ({ s3BatchHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: S3BatchRequest, next: S3BatchNext): Promise<S3BatchResponse> {
        callOrder.push('router-mw');
        return await next(request);
      }
      const router = createS3BatchRouter({ middleware: [routerMiddleware] });
      router.route({
        handler: async () => {
          callOrder.push('handler');
          return { resultCode: 'Succeeded' as const };
        },
      });

      const { event, context } = s3BatchHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'handler']);
    });

    test('executes router middleware before route middleware', async ({ s3BatchHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: S3BatchRequest, next: S3BatchNext): Promise<S3BatchResponse> {
        callOrder.push('router-mw');
        return await next(request);
      }
      async function routeMiddleware(request: S3BatchRequest, next: S3BatchNext): Promise<S3BatchResponse> {
        callOrder.push('route-mw');
        return await next(request);
      }
      const router = createS3BatchRouter({ middleware: [routerMiddleware] });
      router.route({
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return { resultCode: 'Succeeded' as const };
        },
      });

      const { event, context } = s3BatchHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router-level middleware can short-circuit the handler', async ({ s3BatchHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue({ resultCode: 'Succeeded' as const });

      async function blockingMiddleware(_request: S3BatchRequest, _next: S3BatchNext): Promise<S3BatchResponse> {
        return { resultCode: 'PermanentFailure' as const, resultString: 'blocked by router middleware' };
      }
      const router = createS3BatchRouter({ middleware: [blockingMiddleware] });
      router.route({ handler });

      const { event, context } = s3BatchHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
      expect(result.results[0]?.resultString).toBe('blocked by router middleware');
    });
  });
});

suite('S3BatchRouter.canHandleEvent', () => {
  const ownEvents = ['createS3BatchEvent', 'createS3BatchV2Event'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createS3BatchRouter().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
