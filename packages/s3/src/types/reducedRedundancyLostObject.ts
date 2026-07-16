import type { S3BaseRequest, S3FiltersWithoutEventNames, S3Middleware } from './common.js';

// =============================================================================
// Reduced Redundancy Lost Object Event
// =============================================================================

/* v8 ignore next -- @preserve - Constant declaration, no logic to test */
export const REDUCED_REDUNDANCY_LOST_OBJECT_EVENT_NAMES = ['ReducedRedundancyLostObject'] as const;

export type S3ReducedRedundancyLostObjectEventName = (typeof REDUCED_REDUNDANCY_LOST_OBJECT_EVENT_NAMES)[number];

export interface S3ReducedRedundancyLostObjectRequest extends S3BaseRequest {}

export type S3ReducedRedundancyLostObjectHandler = (request: S3ReducedRedundancyLostObjectRequest) => Promise<void>;

export interface S3ReducedRedundancyLostObjectRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  middleware?: S3Middleware[];
  handler: S3ReducedRedundancyLostObjectHandler;
}
