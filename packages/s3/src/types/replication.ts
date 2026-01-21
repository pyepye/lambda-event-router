import type { S3BaseRequest, S3FiltersWithoutEventNames } from './common.js';

// =============================================================================
// Reduced Redundancy Lost Object Event
// =============================================================================

export const REDUCED_REDUNDANCY_LOST_OBJECT_EVENT_NAMES = ['s3:ReducedRedundancyLostObject'] as const;

export type S3ReducedRedundancyLostObjectEventName = (typeof REDUCED_REDUNDANCY_LOST_OBJECT_EVENT_NAMES)[number];

export interface S3ReducedRedundancyLostObjectRequest extends S3BaseRequest {}

export type S3ReducedRedundancyLostObjectHandler = (request: S3ReducedRedundancyLostObjectRequest) => Promise<void>;

export interface S3ReducedRedundancyLostObjectRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  handler: S3ReducedRedundancyLostObjectHandler;
}

// =============================================================================
// Intelligent Tiering Event
// =============================================================================

export const INTELLIGENT_TIERING_EVENT_NAMES = ['s3:IntelligentTiering'] as const;

export type S3IntelligentTieringEventName = (typeof INTELLIGENT_TIERING_EVENT_NAMES)[number];

export interface S3IntelligentTieringRequest extends S3BaseRequest {}

export type S3IntelligentTieringHandler = (request: S3IntelligentTieringRequest) => Promise<void>;

export interface S3IntelligentTieringRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  handler: S3IntelligentTieringHandler;
}

// =============================================================================
// Test Event
// =============================================================================

export const TEST_EVENT_NAMES = ['s3:TestEvent'] as const;

export type S3TestEventName = (typeof TEST_EVENT_NAMES)[number];

export interface S3TestEventRequest extends S3BaseRequest {}

export type S3TestEventHandler = (request: S3TestEventRequest) => Promise<void>;

export interface S3TestEventRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  handler: S3TestEventHandler;
}
