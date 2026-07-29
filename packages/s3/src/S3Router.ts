import type { Context, S3Event, S3EventRecord } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import {
  filterStringMatcher,
  handleEventWithMiddleware,
  isObject,
  orderRoutesBySpecificity,
} from '@lambda-event-router/base';

import type { FiltersToRequest, InternalRoute, RouteBuilder, RouteInput } from './routeTypes.js';
import type { S3Middleware, S3RouterOptions } from './types/common.js';
import type {
  S3BaseRequest,
  S3EventName,
  S3FilterInput,
  S3Filters,
  S3IntelligentTieringRouteDefinition,
  S3LifecycleExpirationRouteDefinition,
  S3LifecycleTransitionRouteDefinition,
  S3ObjectAclRouteDefinition,
  S3ObjectCreatedConvenienceRouteDefinition,
  S3ObjectCreatedRequest,
  S3ObjectRemovedRouteDefinition,
  S3ObjectRestoreRequest,
  S3ObjectRestoreRouteDefinition,
  S3ObjectTaggingRouteDefinition,
  S3ReducedRedundancyLostObjectRouteDefinition,
  S3RouteDefinition,
  S3TestEvent,
  S3TestEventRequest,
  S3TestEventRouteDefinition,
} from './types/index.js';

// =============================================================================
// Internal Types
// =============================================================================

// Internal handler type - uses base request for storage, handlers receive specific types at runtime
type InternalHandler = (request: S3BaseRequest) => Promise<void>;

// =============================================================================
// Define Route Builder
// =============================================================================

export function defineRoute<TFilters extends S3Filters = S3Filters>(
  config: RouteInput<TFilters>,
): RouteBuilder<TFilters> {
  return {
    // The cast bridges the handler narrowed by the filters back to the erased route definition,
    // which takes every notification the route can match
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): S3RouteDefinition {
      return { ...config, handler: handler as InternalHandler };
    },
  };
}

// =============================================================================
// Type Guard
// =============================================================================

function isS3TestEvent(event: unknown): event is S3TestEvent {
  /* v8 ignore next -- @preserve - Guard is for TS. canHandleEvent already checks isObject */
  if (!isObject(event)) return false;
  return event.Event === 's3:TestEvent';
}

// =============================================================================
// S3Router Class
// =============================================================================

export class S3Router implements EventTypeRouter<S3Event | S3TestEvent, undefined> {
  private routes: InternalRoute[] = [];
  private routesOrdered = false;
  private testEventRoute: S3TestEventRouteDefinition | undefined;
  private middleware: S3Middleware[] = [];

  constructor(options?: S3RouterOptions) {
    this.middleware = options?.middleware ?? [];
  }
  // ===========================================================================
  // Event Detection
  // ===========================================================================

  canHandleEvent(event: unknown): event is S3Event | S3TestEvent {
    if (!isObject(event)) return false;

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

  // An inline definition narrows its handler from the eventName filter, the way defineRoute does
  route<TFilters extends S3Filters = S3Filters>(
    definition: RouteInput<TFilters> & { handler: (request: FiltersToRequest<TFilters>) => Promise<void> },
  ): this;

  route(definition: S3RouteDefinition): this;

  route(definition: {
    filters: S3Filters;
    middleware?: S3Middleware[];
    handler: (...args: never[]) => Promise<void>;
  }): this {
    this.routes.push({
      filters: definition.filters,
      middleware: definition.middleware,
      handler: definition.handler as InternalHandler,
    });
    this.routesOrdered = false;
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
    if (this.testEventRoute) {
      throw new Error('A test event route is already registered: a bucket sends one test event, so a router takes one');
    }
    this.testEventRoute = definition;
    return this;
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  async handleEvent(event: S3Event | S3TestEvent, context: Context): Promise<undefined> {
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
    eventName: S3EventName,
    filters: S3Filters | undefined,
    middleware: S3Middleware[],
    handler: InternalHandler,
  ): this {
    this.routes.push({
      filters: { ...filters, eventName: eventName },
      middleware,
      handler,
    });
    this.routesOrdered = false;
    return this;
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

  private orderRoutes(): void {
    if (this.routesOrdered) return;

    this.routes = orderRoutesBySpecificity(this.routes);
    this.routesOrdered = true;
  }

  private async matchRoute(
    record: S3EventRecord,
    bucket: string,
    key: string,
    eventName: string,
  ): Promise<InternalRoute | undefined> {
    this.orderRoutes();

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.eventName !== undefined) {
        const eventNameMatch = filterStringMatcher(eventName, filters.eventName);
        if (!eventNameMatch) continue;
      }

      if (filters.bucket !== undefined) {
        const bucketMatch = filterStringMatcher(bucket, filters.bucket);
        if (!bucketMatch) continue;
      }

      if (filters.key !== undefined) {
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
