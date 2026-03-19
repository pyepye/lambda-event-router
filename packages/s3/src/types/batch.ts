import type { Context, S3BatchEvent, S3BatchEventTask, S3BatchResultResultCode } from 'aws-lambda';
import type { S3BatchResponse } from '../batchResponse.js';

// =============================================================================
// Request Type for Individual Tasks
// =============================================================================

// Request passed to batch handler for each task
export interface S3BatchRequest {
  taskId: S3BatchEventTask['taskId'];
  bucket: string; // Derived from s3BucketArn
  key: S3BatchEventTask['s3Key']; // URL-decoded from task
  versionId: S3BatchEventTask['s3VersionId'];
  task: S3BatchEventTask;
  event: S3BatchEvent;
  context: Context;
}

// =============================================================================
// Handler Types
// =============================================================================

// Handler for processing individual batch tasks
export type S3BatchHandler = (request: S3BatchRequest) => Promise<S3BatchResponse>;

// =============================================================================
// Route Definition Types
// =============================================================================

export interface S3BatchRouteDefinition {
  handler: S3BatchHandler;
}

// =============================================================================
// Re-exports from aws-lambda for convenience
// =============================================================================

export type { S3BatchEvent, S3BatchEventJob, S3BatchEventTask, S3BatchResult, S3BatchResultResult } from 'aws-lambda';
export type { S3BatchResultResultCode };
