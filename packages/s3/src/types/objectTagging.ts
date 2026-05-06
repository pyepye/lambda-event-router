import type { S3BaseRequest, S3FiltersWithoutEventNames, S3Middleware } from './common.js';

// =============================================================================
// Event Names
// =============================================================================

/* v8 ignore next 5 -- @preserve - Constant declaration, no logic to test */
export const OBJECT_TAGGING_EVENT_NAMES = ['ObjectTagging:*', 'ObjectTagging:Put', 'ObjectTagging:Delete'] as const;

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
  middleware?: S3Middleware[];
  handler: S3ObjectTaggingHandler;
}
