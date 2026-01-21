import type { S3BaseRequest, S3FiltersWithoutEventNames } from './common.js';

// =============================================================================
// Event Names
// =============================================================================

export const OBJECT_TAGGING_EVENT_NAMES = [
  's3:ObjectTagging:*',
  's3:ObjectTagging:Put',
  's3:ObjectTagging:Delete',
] as const;

export type S3ObjectTaggingEventName = (typeof OBJECT_TAGGING_EVENT_NAMES)[number];

// =============================================================================
// Request Type
// =============================================================================

// ObjectTagging events - tags are being added or removed from object
export interface S3ObjectTaggingRequest extends S3BaseRequest {}

// =============================================================================
// Handler and Route Definition Types
// =============================================================================

export type S3ObjectTaggingHandler = (request: S3ObjectTaggingRequest) => Promise<void>;

export interface S3ObjectTaggingRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  handler: S3ObjectTaggingHandler;
}
