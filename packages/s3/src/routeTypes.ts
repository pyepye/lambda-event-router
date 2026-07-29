import type { S3BaseRequest, S3EventName, S3Filters, S3Middleware, S3RouteDefinition } from './types/common.js';
import type { S3ObjectCreatedEventName, S3ObjectCreatedRequest } from './types/objectCreated.js';
import type { S3ObjectRestoreEventName, S3ObjectRestoreRequest } from './types/objectRestore.js';

// ObjectCreated and ObjectRestore are the only families whose records carry more than the shared
// fields. Everything else reaches its handler as the base request.
type RequestForEventName<TEventName extends S3EventName> = TEventName extends S3ObjectCreatedEventName
  ? S3ObjectCreatedRequest
  : TEventName extends S3ObjectRestoreEventName
    ? S3ObjectRestoreRequest
    : S3BaseRequest;

// The eventName filter fixes which notification a handler is given. Several names give the union of
// their requests, and no eventName at all means any notification can arrive.
export type FiltersToRequest<TFilters extends S3Filters> = TFilters['eventName'] extends S3EventName
  ? RequestForEventName<TFilters['eventName']>
  : TFilters['eventName'] extends S3EventName[]
    ? RequestForEventName<TFilters['eventName'][number]>
    : S3BaseRequest;

export interface RouteInput<TFilters extends S3Filters> {
  filters: TFilters;
  middleware?: S3Middleware[];
}

export interface RouteBuilder<TFilters extends S3Filters> {
  handle(handler: (request: FiltersToRequest<TFilters>) => Promise<void>): S3RouteDefinition;
}

export interface InternalRoute {
  filters: S3Filters;
  middleware?: S3Middleware[];
  handler: (request: S3BaseRequest) => Promise<void>;
}
