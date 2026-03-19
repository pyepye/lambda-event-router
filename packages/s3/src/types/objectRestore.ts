import type { S3EventRecordGlacierRestoreEventData } from 'aws-lambda';
import type { S3BaseRequest, S3FiltersWithoutEventNames } from './common.js';

// =============================================================================
// Event Names
// =============================================================================

/* v8 ignore next 6 -- @preserve - Constant declaration, no logic to test */
export const OBJECT_RESTORE_EVENT_NAMES = [
  's3:ObjectRestore:*',
  's3:ObjectRestore:Post',
  's3:ObjectRestore:Completed',
  's3:ObjectRestore:Delete',
] as const;

export type S3ObjectRestoreEventName = (typeof OBJECT_RESTORE_EVENT_NAMES)[number];

// =============================================================================
// Request Type
// =============================================================================

// ObjectRestore events include Glacier restoration data
export interface S3ObjectRestoreRequest extends S3BaseRequest {
  // Glacier restore event data (available on Completed events)
  restoreEventData?: S3EventRecordGlacierRestoreEventData;
}

// =============================================================================
// Handler and Route Definition Types
// =============================================================================

export type S3ObjectRestoreHandler = (request: S3ObjectRestoreRequest) => Promise<void>;

// Convenience route definition - eventNames set automatically by the method
export interface S3ObjectRestoreRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  handler: S3ObjectRestoreHandler;
}
