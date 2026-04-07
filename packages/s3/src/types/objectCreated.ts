import type { S3EventRecord } from 'aws-lambda';
import type { S3BaseRequest, S3Filters, S3FiltersWithoutEventNames, S3Middleware } from './common.js';

// =============================================================================
// Event Names
// =============================================================================

/* v8 ignore next 7 -- @preserve - Constant declaration, no logic to test */
export const OBJECT_CREATED_EVENT_NAMES = [
  's3:ObjectCreated:*',
  's3:ObjectCreated:Put',
  's3:ObjectCreated:Post',
  's3:ObjectCreated:Copy',
  's3:ObjectCreated:CompleteMultipartUpload',
] as const;

export type S3ObjectCreatedEventName = (typeof OBJECT_CREATED_EVENT_NAMES)[number];

// =============================================================================
// Request Type
// =============================================================================

// ObjectCreated events include object size and eTag
export interface S3ObjectCreatedRequest extends S3BaseRequest {
  objectSize: S3EventRecord['s3']['object']['size'];
  eTag: S3EventRecord['s3']['object']['eTag'];
}

// =============================================================================
// Handler and Route Definition Types
// =============================================================================

export type S3ObjectCreatedHandler = (request: S3ObjectCreatedRequest) => Promise<void>;

// Generic route definition with full filter options
export interface S3ObjectCreatedRouteDefinition {
  filters: S3Filters;
  middleware?: S3Middleware[];
  handler: S3ObjectCreatedHandler;
}

// Convenience route definition - eventNames set automatically by the method
export interface S3ObjectCreatedConvenienceRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  middleware?: S3Middleware[];
  handler: S3ObjectCreatedHandler;
}
