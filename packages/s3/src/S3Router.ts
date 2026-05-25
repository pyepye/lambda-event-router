import type { Context, S3BatchEvent, S3BatchResult, S3Event, S3EventRecord } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject } from '@lambda-event-router/base';

import type { S3BatchResponse } from './batchResponse.js';
import { isS3BatchResponse } from './batchResponse.js';
import type { S3BatchMiddleware } from './types/batch.js';
import type { S3Middleware, S3RouterOptions } from './types/common.js';
import type {
  S3BaseRequest,
  S3BatchRequest,
  S3BatchRouteDefinition,
  S3FilterInput,
  S3Filters,
  S3IntelligentTieringRouteDefinition,
  S3LifecycleExpirationRouteDefinition,
  S3LifecycleTransitionRouteDefinition,
  S3ObjectAclRouteDefinition,
  S3ObjectCreatedConvenienceRouteDefinition,
  S3ObjectCreatedHandler,
  S3ObjectCreatedRequest,
  S3ObjectCreatedRouteDefinition,
  S3ObjectRemovedRouteDefinition,
  S3ObjectRestoreRequest,
  S3ObjectRestoreRouteDefinition,
  S3ObjectTaggingRouteDefinition,
  S3ReducedRedundancyLostObjectRouteDefinition,
  S3TestEvent,
  S3TestEventRequest,
  S3TestEventRouteDefinition,
} from './types/index.js';

// =============================================================================
// Internal Types
// =============================================================================

// Internal handler type - uses base request for storage, handlers receive specific types at runtime
type InternalHandler = (request: S3BaseRequest) => Promise<void>;

interface InternalRoute {
  filters: S3Filters;
  middleware?: S3Middleware[];
  handler: InternalHandler;
}

interface RouteInput {
  filters: S3Filters;
  middleware?: S3Middleware[];
}

interface RouteBuilder {
  handle(handler: S3ObjectCreatedHandler): S3ObjectCreatedRouteDefinition;
}

// =============================================================================
// Define Route Builder
// =============================================================================

export function defineRoute(config: RouteInput): RouteBuilder {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): S3ObjectCreatedRouteDefinition {
      return { ...config, handler };
    },
  };
}

// =============================================================================
// Type Guard
// =============================================================================

function isS3BatchEvent(event: unknown): event is S3BatchEvent {
  /* v8 ignore next -- @preserve - Guard is for TS. canHandleEvent already checks isObject */
  if (!isObject(event)) return false;
  return (
    typeof event.invocationSchemaVersion === 'string' &&
    typeof event.invocationId === 'string' &&
    isObject(event.job) &&
    Array.isArray(event.tasks)
  );
}

function isS3TestEvent(event: unknown): event is S3TestEvent {
  /* v8 ignore next -- @preserve - Guard is for TS. canHandleEvent already checks isObject */
  if (!isObject(event)) return false;
  return event.Event === 's3:TestEvent';
}

// =============================================================================
// S3Router Class
// =============================================================================

export class S3Router implements EventTypeRouter<S3Event | S3BatchEvent | S3TestEvent, undefined | S3BatchResult> {
  private routes: InternalRoute[] = [];
  private batchRoute: S3BatchRouteDefinition | undefined;
  private testEventRoute: S3TestEventRouteDefinition | undefined;
  private middleware: S3Middleware[] = [];

  constructor(options?: S3RouterOptions) {
    this.middleware = options?.middleware ?? [];
  }
  // ===========================================================================
  // Event Detection
  // ===========================================================================

  canHandleEvent(event: unknown): event is S3Event | S3BatchEvent | S3TestEvent {
    if (!isObject(event)) return false;

    // Check for S3 Batch Event
    if (isS3BatchEvent(event)) return true;

    // Check for S3 Test Event
    if (isS3TestEvent(event)) return true;

    // Check for S3 Event Notification
    if (!Array.isArray(event.Records)) return false;
    const firstRecord = event.Records[0];
    if (!isObject(firstRecord)) return false;
    return firstRecord.eventSource === 'aws:s3';
  }

  // ===========================================================================
  // Generic Route Method
  // ===========================================================================

  route(definition: S3ObjectCreatedRouteDefinition): this {
    this.routes.push({
      filters: definition.filters,
      middleware: definition.middleware,
      handler: definition.handler as InternalHandler,
    });
    return this;
  }

  // ===========================================================================
  // ObjectCreated Methods
  // ===========================================================================

  objectCreated(definition: S3ObjectCreatedConvenienceRouteDefinition): this {
    return this.addRoute(
      'ObjectCreated:*',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  objectCreatedPut(definition: S3ObjectCreatedConvenienceRouteDefinition): this {
    return this.addRoute(
      'ObjectCreated:Put',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  objectCreatedPost(definition: S3ObjectCreatedConvenienceRouteDefinition): this {
    return this.addRoute(
      'ObjectCreated:Post',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  objectCreatedCopy(definition: S3ObjectCreatedConvenienceRouteDefinition): this {
    return this.addRoute(
      'ObjectCreated:Copy',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  objectCreatedCompleteMultipartUpload(definition: S3ObjectCreatedConvenienceRouteDefinition): this {
    return this.addRoute(
      'ObjectCreated:CompleteMultipartUpload',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  // ===========================================================================
  // ObjectRemoved Methods
  // ===========================================================================

  objectRemoved(definition: S3ObjectRemovedRouteDefinition): this {
    return this.addRoute(
      'ObjectRemoved:*',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  objectRemovedDelete(definition: S3ObjectRemovedRouteDefinition): this {
    return this.addRoute(
      'ObjectRemoved:Delete',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  objectRemovedDeleteMarkerCreated(definition: S3ObjectRemovedRouteDefinition): this {
    return this.addRoute(
      'ObjectRemoved:DeleteMarkerCreated',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  // ===========================================================================
  // ObjectRestore Methods
  // ===========================================================================

  objectRestore(definition: S3ObjectRestoreRouteDefinition): this {
    return this.addRoute(
      'ObjectRestore:*',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  objectRestorePost(definition: S3ObjectRestoreRouteDefinition): this {
    return this.addRoute(
      'ObjectRestore:Post',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  objectRestoreCompleted(definition: S3ObjectRestoreRouteDefinition): this {
    return this.addRoute(
      'ObjectRestore:Completed',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  objectRestoreDelete(definition: S3ObjectRestoreRouteDefinition): this {
    return this.addRoute(
      'ObjectRestore:Delete',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  // ===========================================================================
  // Lifecycle Methods
  // ===========================================================================

  lifecycleExpiration(definition: S3LifecycleExpirationRouteDefinition): this {
    return this.addRoute(
      'LifecycleExpiration:*',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  lifecycleExpirationDelete(definition: S3LifecycleExpirationRouteDefinition): this {
    return this.addRoute(
      'LifecycleExpiration:Delete',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  lifecycleExpirationDeleteMarkerCreated(definition: S3LifecycleExpirationRouteDefinition): this {
    return this.addRoute(
      'LifecycleExpiration:DeleteMarkerCreated',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  lifecycleTransition(definition: S3LifecycleTransitionRouteDefinition): this {
    return this.addRoute(
      'LifecycleTransition',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  // ===========================================================================
  // ObjectTagging Methods
  // ===========================================================================

  objectTagging(definition: S3ObjectTaggingRouteDefinition): this {
    return this.addRoute(
      'ObjectTagging:*',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  objectTaggingPut(definition: S3ObjectTaggingRouteDefinition): this {
    return this.addRoute(
      'ObjectTagging:Put',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  objectTaggingDelete(definition: S3ObjectTaggingRouteDefinition): this {
    return this.addRoute(
      'ObjectTagging:Delete',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  // ===========================================================================
  // ObjectAcl Methods
  // ===========================================================================

  objectAclPut(definition: S3ObjectAclRouteDefinition): this {
    return this.addRoute(
      'ObjectAcl:Put',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  // ===========================================================================
  // Other Event Methods
  // ===========================================================================

  reducedRedundancyLostObject(definition: S3ReducedRedundancyLostObjectRouteDefinition): this {
    return this.addRoute(
      'ReducedRedundancyLostObject',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  intelligentTiering(definition: S3IntelligentTieringRouteDefinition): this {
    return this.addRoute(
      'IntelligentTiering',
      definition.filters,
      definition.middleware ?? [],
      definition.handler as InternalHandler,
    );
  }

  testEvent(definition: S3TestEventRouteDefinition): this {
    this.testEventRoute = definition;
    return this;
  }

  // ===========================================================================
  // Batch Operations
  // ===========================================================================

  batchOperation(definition: S3BatchRouteDefinition): this {
    this.batchRoute = definition;
    return this;
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  async handleEvent(event: S3Event | S3BatchEvent | S3TestEvent, context: Context): Promise<undefined | S3BatchResult> {
    // Handle S3 Batch Event
    if (isS3BatchEvent(event)) {
      return this.handleBatchEvent(event, context);
    }

    // Handle S3 Test Event - short-circuits notification routing
    if (isS3TestEvent(event)) {
      return this.handleTestEvent(event, context);
    }

    // Handle S3 Event Notification - process records sequentially
    for (const record of event.Records) {
      await this.processRecord(record, context);
    }
  }

  private async handleTestEvent(event: S3TestEvent, context: Context): Promise<undefined> {
    // No handler registered: swallow the setup ping so the invocation succeeds
    if (!this.testEventRoute) return;

    const request: S3TestEventRequest = {
      bucket: event.Bucket,
      time: event.Time,
      requestId: event.RequestId,
      hostId: event.HostId,
      context,
    };
    await this.testEventRoute.handler(request);
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private addRoute(
    eventName: string,
    filters: S3Filters | undefined,
    middleware: S3Middleware[],
    handler: InternalHandler,
  ): this {
    this.routes.push({
      filters: { ...filters, eventName: eventName },
      middleware,
      handler,
    });
    return this;
  }

  private async handleBatchEvent(event: S3BatchEvent, context: Context): Promise<S3BatchResult> {
    if (!this.batchRoute) {
      throw new Error('No batch operation handler registered');
    }

    // S3 Batch expects a per-task result. Missing tasks missing in the response gets marked treatMissingKeysAs which
    // results as a PermanentFailure
    const results: S3BatchResult['results'] = [];
    for (const task of event.tasks) {
      const request = this.buildBatchRequest(task, event, context);
      const response = await this.processBatchTask(this.batchRoute, request);
      results.push({
        taskId: task.taskId,
        resultCode: response.resultCode,
        resultString: response.resultString ?? '',
      });
    }

    return this.buildBatchResult(event, results);
  }

  private buildBatchRequest(
    task: S3BatchEvent['tasks'][number],
    event: S3BatchEvent,
    context: Context,
  ): S3BatchRequest {
    // The bucket name is the last ARN segment. S3 Batch may send either arn:aws:s3:region:account:bucket
    // or arn:aws:s3:::bucket, and a bucket name holds no colon.
    const bucketArn = task.s3BucketArn;
    /* v8 ignore next -- @preserve - split always yields at least one segment, so the fallback is unreachable */
    const bucket = bucketArn.split(':').at(-1) ?? '';

    // S3 Batch keys are URL-encoded
    const key = decodeURIComponent(task.s3Key.replace(/\+/g, ' '));

    return {
      taskId: task.taskId,
      bucket,
      key,
      versionId: task.s3VersionId,
      task,
      event,
      context,
    };
  }

  private async processBatchTask(route: S3BatchRouteDefinition, request: S3BatchRequest): Promise<S3BatchResponse> {
    try {
      const batchMiddleware: S3BatchMiddleware[] = route.middleware ?? [];
      if (batchMiddleware.length > 0) {
        return await handleEventWithMiddleware(batchMiddleware, request, route.handler);
      }
      return await route.handler(request);
    } catch (error) {
      if (isS3BatchResponse(error)) {
        return error;
      }
      throw error;
    }
  }

  private buildBatchResult(event: S3BatchEvent, results: S3BatchResult['results']): S3BatchResult {
    return {
      invocationSchemaVersion: event.invocationSchemaVersion,
      treatMissingKeysAs: this.batchRoute?.treatMissingKeysAs ?? 'PermanentFailure',
      invocationId: event.invocationId,
      results,
    };
  }

  private async processRecord(record: S3EventRecord, context: Context): Promise<void> {
    const bucket = record.s3.bucket.name;
    // S3 sends URL-encoded keys (spaces as '+', special chars encoded)
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const eventName = record.eventName;

    const route = await this.matchRoute(record, bucket, key, eventName);
    if (!route) {
      throw new Error(`No route matched for record from bucket ${bucket}, key ${key}`);
    }

    const request = this.buildRequest(record, context, bucket, key);

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(
    record: S3EventRecord,
    bucket: string,
    key: string,
    eventName: string,
  ): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.eventName) {
        const eventNameMatch = filterStringMatcher(eventName, filters.eventName);
        if (!eventNameMatch) continue;
      }

      if (filters.bucket) {
        const bucketMatch = filterStringMatcher(bucket, filters.bucket);
        if (!bucketMatch) continue;
      }

      if (filters.key) {
        const keyMatch = filterStringMatcher(key, filters.key);
        if (!keyMatch) continue;
      }

      if (filters.custom) {
        const input: S3FilterInput = { bucket, key, eventName, record };
        const match = await filters.custom(input);
        if (!match) continue;
      }

      return route;
    }
    return undefined;
  }

  private buildRequest(
    record: S3EventRecord,
    context: Context,
    bucket: string,
    key: string,
  ): S3BaseRequest | S3ObjectCreatedRequest | S3ObjectRestoreRequest {
    const s3Object = record.s3.object;
    const eventName = record.eventName;

    // Base request properties
    const baseRequest: S3BaseRequest = {
      bucket,
      key,
      eventName,
      eventTime: record.eventTime,
      versionId: s3Object.versionId,
      record,
      context,
    };

    // ObjectRestore events include glacier restoration data
    if (eventName.startsWith('ObjectRestore:')) {
      const restoreRequest: S3ObjectRestoreRequest = {
        ...baseRequest,
        restoreEventData: record.glacierEventData?.restoreEventData,
      };
      return restoreRequest;
    }

    // ObjectCreated events include size and eTag
    if (eventName.startsWith('ObjectCreated:')) {
      const createdRequest: S3ObjectCreatedRequest = {
        ...baseRequest,
        objectSize: s3Object.size,
        eTag: s3Object.eTag,
      };
      return createdRequest;
    }

    // All other events use base request (ObjectRemoved, Lifecycle, Tagging, etc.)
    return baseRequest;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createS3Router(options?: S3RouterOptions): S3Router {
  return new S3Router(options);
}
