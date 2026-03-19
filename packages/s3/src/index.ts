export type { S3BatchResponse } from './batchResponse.js';
export { isS3BatchResponse, PermanentFailure, Succeeded, TemporaryFailure } from './batchResponse.js';
export { createS3Router, defineRoute, S3Router } from './S3Router.js';

// Re-export all types
export type {
  // Common types
  S3BaseRequest,
  // Batch operation types
  S3BatchEvent,
  S3BatchEventJob,
  S3BatchEventTask,
  S3BatchHandler,
  S3BatchRequest,
  S3BatchResult,
  S3BatchResultResult,
  S3BatchResultResultCode,
  S3BatchRouteDefinition,
  S3FilterInput,
  S3Filters,
  S3FiltersWithoutEventNames,
  // Replication and misc types
  S3IntelligentTieringEventName,
  S3IntelligentTieringHandler,
  S3IntelligentTieringRequest,
  S3IntelligentTieringRouteDefinition,
  // Lifecycle types
  S3LifecycleExpirationEventName,
  S3LifecycleExpirationHandler,
  S3LifecycleExpirationRequest,
  S3LifecycleExpirationRouteDefinition,
  S3LifecycleTransitionEventName,
  S3LifecycleTransitionHandler,
  S3LifecycleTransitionRequest,
  S3LifecycleTransitionRouteDefinition,
  // ObjectAcl types
  S3ObjectAclEventName,
  S3ObjectAclHandler,
  S3ObjectAclRequest,
  S3ObjectAclRouteDefinition,
  // ObjectCreated types
  S3ObjectCreatedConvenienceRouteDefinition,
  S3ObjectCreatedEventName,
  S3ObjectCreatedHandler,
  S3ObjectCreatedRequest,
  S3ObjectCreatedRouteDefinition,
  // ObjectRemoved types
  S3ObjectRemovedEventName,
  S3ObjectRemovedHandler,
  S3ObjectRemovedRequest,
  S3ObjectRemovedRouteDefinition,
  // ObjectRestore types
  S3ObjectRestoreEventName,
  S3ObjectRestoreHandler,
  S3ObjectRestoreRequest,
  S3ObjectRestoreRouteDefinition,
  // ObjectTagging types
  S3ObjectTaggingEventName,
  S3ObjectTaggingHandler,
  S3ObjectTaggingRequest,
  S3ObjectTaggingRouteDefinition,
  S3ReducedRedundancyLostObjectEventName,
  S3ReducedRedundancyLostObjectHandler,
  S3ReducedRedundancyLostObjectRequest,
  S3ReducedRedundancyLostObjectRouteDefinition,
  S3TestEventHandler,
  S3TestEventName,
  S3TestEventRequest,
  S3TestEventRouteDefinition,
} from './types/index.js';

// Re-export event name constants
export {
  INTELLIGENT_TIERING_EVENT_NAMES,
  LIFECYCLE_EXPIRATION_EVENT_NAMES,
  LIFECYCLE_TRANSITION_EVENT_NAMES,
  OBJECT_ACL_EVENT_NAMES,
  OBJECT_CREATED_EVENT_NAMES,
  OBJECT_REMOVED_EVENT_NAMES,
  OBJECT_RESTORE_EVENT_NAMES,
  OBJECT_TAGGING_EVENT_NAMES,
  REDUCED_REDUNDANCY_LOST_OBJECT_EVENT_NAMES,
  TEST_EVENT_NAMES,
} from './types/index.js';
