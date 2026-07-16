import type { Context } from 'aws-lambda';

// =============================================================================
// Test Event
// =============================================================================

export interface S3TestEvent {
  Service: 'Amazon S3';
  Event: 's3:TestEvent';
  Time: string;
  Bucket: string;
  RequestId: string;
  HostId: string;
}

export interface S3TestEventRequest {
  bucket: string;
  time: string;
  requestId: string;
  hostId: string;
  context: Context;
}

export type S3TestEventHandler = (request: S3TestEventRequest) => Promise<void>;

export interface S3TestEventRouteDefinition {
  handler: S3TestEventHandler;
}
