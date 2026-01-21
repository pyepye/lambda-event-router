import type { S3BaseRequest, S3FiltersWithoutEventNames } from './common.js';

// =============================================================================
// Event Names
// =============================================================================

export const OBJECT_REMOVED_EVENT_NAMES = [
  's3:ObjectRemoved:*',
  's3:ObjectRemoved:Delete',
  's3:ObjectRemoved:DeleteMarkerCreated',
] as const;

export type S3ObjectRemovedEventName = (typeof OBJECT_REMOVED_EVENT_NAMES)[number];

// =============================================================================
// Request Type
// =============================================================================

// ObjectRemoved events don't include size/eTag (object is being deleted)
export interface S3ObjectRemovedRequest extends S3BaseRequest {}

// =============================================================================
// Handler and Route Definition Types
// =============================================================================

export type S3ObjectRemovedHandler = (request: S3ObjectRemovedRequest) => Promise<void>;

// Convenience route definition - eventNames set automatically by the method
export interface S3ObjectRemovedRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  handler: S3ObjectRemovedHandler;
}
