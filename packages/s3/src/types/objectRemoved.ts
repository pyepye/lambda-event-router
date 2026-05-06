import type { S3BaseRequest, S3FiltersWithoutEventNames, S3Middleware } from './common.js';

// =============================================================================
// Event Names
// =============================================================================

/* v8 ignore next 5 -- @preserve - Constant declaration, no logic to test */
export const OBJECT_REMOVED_EVENT_NAMES = [
  'ObjectRemoved:*',
  'ObjectRemoved:Delete',
  'ObjectRemoved:DeleteMarkerCreated',
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
  middleware?: S3Middleware[];
  handler: S3ObjectRemovedHandler;
}
