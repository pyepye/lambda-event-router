import type { S3BaseRequest, S3FiltersWithoutEventNames, S3Middleware } from './common.js';

// =============================================================================
// Intelligent Tiering Event
// =============================================================================

/* v8 ignore next -- @preserve - Constant declaration, no logic to test */
export const INTELLIGENT_TIERING_EVENT_NAMES = ['IntelligentTiering'] as const;

export type S3IntelligentTieringEventName = (typeof INTELLIGENT_TIERING_EVENT_NAMES)[number];

export interface S3IntelligentTieringRequest extends S3BaseRequest {}

export type S3IntelligentTieringHandler = (request: S3IntelligentTieringRequest) => Promise<void>;

export interface S3IntelligentTieringRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  middleware?: S3Middleware[];
  handler: S3IntelligentTieringHandler;
}
