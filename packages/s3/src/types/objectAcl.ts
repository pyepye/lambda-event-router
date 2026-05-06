import type { S3BaseRequest, S3FiltersWithoutEventNames, S3Middleware } from './common.js';

// =============================================================================
// Event Names
// =============================================================================

/* v8 ignore next -- @preserve - Constant declaration, no logic to test */
export const OBJECT_ACL_EVENT_NAMES = ['ObjectAcl:Put'] as const;

export type S3ObjectAclEventName = (typeof OBJECT_ACL_EVENT_NAMES)[number];

// =============================================================================
// Request Type
// =============================================================================

// ObjectAcl:Put events - ACL is being set on object
export interface S3ObjectAclRequest extends S3BaseRequest {}

// =============================================================================
// Handler and Route Definition Types
// =============================================================================

export type S3ObjectAclHandler = (request: S3ObjectAclRequest) => Promise<void>;

export interface S3ObjectAclRouteDefinition {
  filters?: S3FiltersWithoutEventNames;
  middleware?: S3Middleware[];
  handler: S3ObjectAclHandler;
}
