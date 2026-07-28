import type { Context, S3EventRecord } from 'aws-lambda';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

import type { S3IntelligentTieringEventName } from './intelligentTiering.js';
import type { S3LifecycleExpirationEventName, S3LifecycleTransitionEventName } from './lifecycle.js';
import type { S3ObjectAclEventName } from './objectAcl.js';
import type { S3ObjectCreatedEventName } from './objectCreated.js';
import type { S3ObjectRemovedEventName } from './objectRemoved.js';
import type { S3ObjectRestoreEventName } from './objectRestore.js';
import type { S3ObjectTaggingEventName } from './objectTagging.js';
import type { S3ReducedRedundancyLostObjectEventName } from './reducedRedundancyLostObject.js';

// Every name a notification can carry, plus the per-family wildcards a bucket notification can be
// configured with. S3 sends a specific name, so a wildcard only ever matches on the filter side.
export type S3EventName =
  | S3ObjectCreatedEventName
  | S3ObjectRemovedEventName
  | S3ObjectRestoreEventName
  | S3ObjectTaggingEventName
  | S3ObjectAclEventName
  | S3LifecycleExpirationEventName
  | S3LifecycleTransitionEventName
  | S3IntelligentTieringEventName
  | S3ReducedRedundancyLostObjectEventName;

// =============================================================================
// Filter Types
// =============================================================================

// Input for custom filters
export interface S3FilterInput {
  bucket: S3EventRecord['s3']['bucket']['name'];
  key: S3EventRecord['s3']['object']['key']; // URL-decoded from record
  eventName: S3EventRecord['eventName'];
  record: S3EventRecord;
}

// Filter options for S3 routes
export interface S3Filters {
  eventName?: S3EventName | S3EventName[];
  bucket?: FilterStringMatcher;
  key?: FilterStringMatcher;
  custom?: (input: S3FilterInput) => boolean | Promise<boolean>;
}

// Filters without eventName - used by convenience methods that set eventName automatically
export type S3FiltersWithoutEventNames = Omit<S3Filters, 'eventName'>;

// =============================================================================
// Base Request Type
// =============================================================================

// Base request properties shared by all S3 event handlers
export interface S3BaseRequest {
  bucket: S3EventRecord['s3']['bucket']['name'];
  key: S3EventRecord['s3']['object']['key']; // URL-decoded from record
  eventName: S3EventRecord['eventName'];
  eventTime: S3EventRecord['eventTime'];
  versionId: S3EventRecord['s3']['object']['versionId'];
  record: S3EventRecord;
  context: Context;
}

export type S3Middleware = Middleware<S3BaseRequest, void>;

export interface S3RouterOptions {
  middleware?: S3Middleware[];
}
