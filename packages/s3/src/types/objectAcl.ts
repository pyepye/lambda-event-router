import type { S3BaseRequest, S3FiltersWithoutEventNames } from './common.js';

// =============================================================================
// Event Names
// =============================================================================

export const OBJECT_ACL_EVENT_NAMES = ['s3:ObjectAcl:Put'] as const;

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
  handler: S3ObjectAclHandler;
}
