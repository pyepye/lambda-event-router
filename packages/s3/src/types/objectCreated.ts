import type { S3EventRecord } from 'aws-lambda';

import type { S3BaseRequest, S3FiltersWithoutEventNames, S3Middleware } from './common.js';

// =============================================================================
// Event Names
// =============================================================================

/* v8 ignore next 7 -- @preserve - Constant declaration, no logic to test */
export const OBJECT_CREATED_EVENT_NAMES = [
  'ObjectCreated:*',
  'ObjectCreated:Put',
  'ObjectCreated:Post',
  'ObjectCreated:Copy',
  'ObjectCreated:CompleteMultipartUpload',
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

// Convenience route definition - eventNames set automatically by the method
export interface S3ObjectCreatedConvenienceRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  middleware?: S3Middleware[];
  handler: S3ObjectCreatedHandler;
}
