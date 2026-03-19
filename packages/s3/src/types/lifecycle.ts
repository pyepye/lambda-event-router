import type { S3BaseRequest, S3FiltersWithoutEventNames } from './common.js';

// =============================================================================
// Lifecycle Expiration Event Names
// =============================================================================

/* v8 ignore next 5 -- @preserve - Constant declaration, no logic to test */
export const LIFECYCLE_EXPIRATION_EVENT_NAMES = [
  's3:LifecycleExpiration:*',
  's3:LifecycleExpiration:Delete',
  's3:LifecycleExpiration:DeleteMarkerCreated',
] as const;

export type S3LifecycleExpirationEventName = (typeof LIFECYCLE_EXPIRATION_EVENT_NAMES)[number];

// =============================================================================
// Lifecycle Transition Event Names
// =============================================================================

/* v8 ignore next -- @preserve - Constant declaration, no logic to test */
export const LIFECYCLE_TRANSITION_EVENT_NAMES = ['s3:LifecycleTransition'] as const;

export type S3LifecycleTransitionEventName = (typeof LIFECYCLE_TRANSITION_EVENT_NAMES)[number];

// =============================================================================
// Request Types
// =============================================================================

// LifecycleExpiration events - object is being expired/deleted by lifecycle policy
export interface S3LifecycleExpirationRequest extends S3BaseRequest {}

// LifecycleTransition events - object is being transitioned to another storage class
export interface S3LifecycleTransitionRequest extends S3BaseRequest {}

// =============================================================================
// Handler Types
// =============================================================================

export type S3LifecycleExpirationHandler = (request: S3LifecycleExpirationRequest) => Promise<void>;
export type S3LifecycleTransitionHandler = (request: S3LifecycleTransitionRequest) => Promise<void>;

// =============================================================================
// Route Definition Types
// =============================================================================

export interface S3LifecycleExpirationRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  handler: S3LifecycleExpirationHandler;
}

export interface S3LifecycleTransitionRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  handler: S3LifecycleTransitionHandler;
}
