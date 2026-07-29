import type { Context, S3BatchResult } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject } from '@lambda-event-router/base';

import type { S3BatchResponse } from './batchResponse.js';
import { isS3BatchResponse } from './batchResponse.js';
import type {
  S3BatchAnyEvent,
  S3BatchAnyEventTask,
  S3BatchMiddleware,
  S3BatchRequest,
  S3BatchRouteDefinition,
  S3BatchRouterOptions,
} from './types/index.js';

export class S3BatchRouter implements EventTypeRouter<S3BatchAnyEvent, S3BatchResult> {
  private batchRoute: S3BatchRouteDefinition | undefined;
  private middleware: S3BatchMiddleware[] = [];

  constructor(options?: S3BatchRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is S3BatchAnyEvent {
    if (!isObject(event)) return false;
    if (typeof event.invocationSchemaVersion !== 'string') return false;
    if (typeof event.invocationId !== 'string') return false;
    if (!isObject(event.job)) return false;
    return Array.isArray(event.tasks);
  }

  route(definition: S3BatchRouteDefinition): this {
    if (this.batchRoute) {
      throw new Error('A batch route is already registered: a job sends one task shape, so a router takes one');
    }
    this.batchRoute = definition;
    return this;
  }

  async handleEvent(event: S3BatchAnyEvent, context: Context): Promise<S3BatchResult> {
    if (!this.batchRoute) {
      throw new Error('No batch route registered: register one with route() before the job runs');
    }

    // S3 Batch expects a per-task result. A task missing from the response is counted as
    // treatMissingKeysAs, which defaults to PermanentFailure.
    const results: S3BatchResult['results'] = [];
    for (const task of event.tasks) {
      const request = this.buildRequest(task, event, context);
      const response = await this.processTask(this.batchRoute, request);
      results.push({
        taskId: task.taskId,
        resultCode: response.resultCode,
        resultString: response.resultString ?? '',
      });
    }

    return this.buildResult(this.batchRoute, event, results);
  }

  private buildRequest(task: S3BatchAnyEventTask, event: S3BatchAnyEvent, context: Context): S3BatchRequest {
    // Schema 2.0 names the bucket. Schema 1.0 sends an ARN, either arn:aws:s3:region:account:bucket
    // or arn:aws:s3:::bucket, and a bucket name holds no colon, so the name is its last segment.
    /* v8 ignore next -- @preserve - split always yields at least one segment, so the fallback is unreachable */
    const bucket = 's3Bucket' in task ? task.s3Bucket : (task.s3BucketArn.split(':').at(-1) ?? '');

    // S3 Batch keys are URL-encoded
    const key = decodeURIComponent(task.s3Key.replace(/\+/g, ' '));

    const request: S3BatchRequest = {
      taskId: task.taskId,
      bucket,
      key,
      versionId: task.s3VersionId,
      task,
      event,
      context,
    };

    // userArguments is a schema 2.0 field, so it stays off the request for a 1.0 job.
    if ('userArguments' in event.job && event.job.userArguments) {
      request.userArguments = event.job.userArguments;
    }

    return request;
  }

  private async processTask(route: S3BatchRouteDefinition, request: S3BatchRequest): Promise<S3BatchResponse> {
    try {
      const middleware: S3BatchMiddleware[] = [...this.middleware, ...(route.middleware ?? [])];
      if (middleware.length > 0) {
        return await handleEventWithMiddleware(middleware, request, route.handler);
      }
      return await route.handler(request);
    } catch (error) {
      if (isS3BatchResponse(error)) {
        return error;
      }
      throw error;
    }
  }

  private buildResult(
    route: S3BatchRouteDefinition,
    event: S3BatchAnyEvent,
    results: S3BatchResult['results'],
  ): S3BatchResult {
    return {
      invocationSchemaVersion: event.invocationSchemaVersion,
      treatMissingKeysAs: route.treatMissingKeysAs ?? 'PermanentFailure',
      invocationId: event.invocationId,
      results,
    };
  }
}

export function createS3BatchRouter(options?: S3BatchRouterOptions): S3BatchRouter {
  return new S3BatchRouter(options);
}
