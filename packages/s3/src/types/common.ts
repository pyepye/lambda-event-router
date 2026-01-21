import type { Context, S3EventRecord } from 'aws-lambda';

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
  eventNames?: S3EventRecord['eventName'][];
  buckets?: S3EventRecord['s3']['bucket']['name'][];
  prefixes?: string[];
  suffixes?: string[];
  includes?: string[];
  customFilter?: (input: S3FilterInput) => boolean;
}

// Filters without eventNames - used by convenience methods that set eventNames automatically
export type S3FiltersWithoutEventNames = Omit<S3Filters, 'eventNames'>;

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
