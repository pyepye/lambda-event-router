import type { Middleware } from '@lambda-event-router/base';
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
  eventName?: S3EventRecord['eventName'] | S3EventRecord['eventName'][];
  bucket?: S3EventRecord['s3']['bucket']['name'] | S3EventRecord['s3']['bucket']['name'][];
  prefix?: string | string[];
  suffix?: string | string[];
  includes?: string | string[];
  customFilter?: (input: S3FilterInput) => boolean | Promise<boolean>;
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

export type S3Middleware = Middleware<S3BaseRequest, void>;

export interface S3RouterOptions {
  middleware?: S3Middleware[];
}
