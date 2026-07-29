import type { Context, S3BatchEvent, S3BatchEventTask, S3BatchResultResultCode } from 'aws-lambda';

import type { Middleware } from '@lambda-event-router/base';

import type { S3BatchResponse } from '../batchResponse.js';

// =============================================================================
// Schema 2.0 Event
// =============================================================================

// A job on a directory bucket must use schema 2.0, and so must any job passing userArguments. The
// task names the bucket rather than its ARN, and aws-lambda declares neither shape.
export interface S3BatchV2EventTask {
  taskId: string;
  s3Key: string;
  s3VersionId: string | null;
  s3Bucket: string;
}

export interface S3BatchV2Event {
  invocationSchemaVersion: '2.0';
  invocationId: string;
  job: {
    id: string;
    userArguments?: Record<string, string>;
  };
  tasks: S3BatchV2EventTask[];
}

export type S3BatchAnyEvent = S3BatchEvent | S3BatchV2Event;
export type S3BatchAnyEventTask = S3BatchEventTask | S3BatchV2EventTask;

// =============================================================================
// Request Type for Individual Tasks
// =============================================================================

// Request passed to batch handler for each task
export interface S3BatchRequest {
  taskId: string;
  bucket: string; // s3Bucket on schema 2.0, taken off s3BucketArn on 1.0
  key: string; // URL-decoded from task
  versionId: string | null;
  userArguments?: Record<string, string>; // Schema 2.0 only
  task: S3BatchAnyEventTask;
  event: S3BatchAnyEvent;
  context: Context;
}

// =============================================================================
// Handler Types
// =============================================================================

// Handler for processing individual batch tasks
export type S3BatchHandler = (request: S3BatchRequest) => Promise<S3BatchResponse>;

// Middleware for batch operations (different request/response types from notification middleware)
export type S3BatchMiddleware = Middleware<S3BatchRequest, S3BatchResponse>;

// =============================================================================
// Route Definition Types
// =============================================================================

export interface S3BatchRouterOptions {
  middleware?: S3BatchMiddleware[];
}

export interface S3BatchRouteDefinition {
  treatMissingKeysAs?: S3BatchResultResultCode; // How S3 batch should treat missing keys in the response. Defaults to 'PermanentFailure'
  middleware?: S3BatchMiddleware[];
  handler: S3BatchHandler;
}

// =============================================================================
// Re-exports from aws-lambda for convenience
// =============================================================================

export type { S3BatchEvent, S3BatchEventJob, S3BatchEventTask, S3BatchResult, S3BatchResultResult } from 'aws-lambda';
export type { S3BatchResultResultCode };
