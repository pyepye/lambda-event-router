import type { Schema } from '@lambda-event-router/base';
import type {
  Context,
  S3ObjectCreatedNotificationEventDetail,
  S3ObjectDeletedNotificationEventDetail,
  S3ObjectRestoreCompletedNotificationEventDetail,
  S3ObjectRestoreInitiatedNotificationEventDetail,
} from 'aws-lambda';

// =============================================================================
// Known AWS Event Detail Types
// =============================================================================

export interface EC2StateChangeDetail {
  'instance-id': string;
  state: 'pending' | 'running' | 'stopping' | 'stopped' | 'shutting-down' | 'terminated';
}

// Scheduled events from EventBridge Rules have an empty detail
export type ScheduledEventDetail = Record<string, never>;

// Type map: source -> detailType -> detail type
// Users can extend this via module augmentation for custom events
export interface EventBridgeDetailTypeMap {
  'aws.ec2': {
    'EC2 Instance State-change Notification': EC2StateChangeDetail;
  };
  'aws.s3': {
    'Object Created': S3ObjectCreatedNotificationEventDetail;
    'Object Deleted': S3ObjectDeletedNotificationEventDetail;
    'Object Restore Initiated': S3ObjectRestoreInitiatedNotificationEventDetail;
    'Object Restore Completed': S3ObjectRestoreCompletedNotificationEventDetail;
  };
  'aws.events': {
    'Scheduled Event': ScheduledEventDetail;
  };
}

// Lookup detail type from source and detailType
// Returns unknown if not found in the map
export type LookupDetailType<
  TSources extends readonly string[] | undefined,
  TDetailTypes extends readonly string[] | undefined,
> = TSources extends readonly [infer Source extends keyof EventBridgeDetailTypeMap]
  ? TDetailTypes extends readonly [infer DetailType extends keyof EventBridgeDetailTypeMap[Source]]
    ? EventBridgeDetailTypeMap[Source][DetailType]
    : unknown
  : unknown;

// =============================================================================
// Event Types
// =============================================================================

export interface EventBridgeEventEnvelope<TDetail = unknown> {
  version: string;
  id: string;
  source: string;
  'detail-type': string;
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: TDetail;
}

export interface EventBridgeRequest<TDetail = unknown> {
  source: string;
  detailType: string;
  detail: TDetail;
  account: string;
  region: string;
  time: string;
  resources: string[];
  id: string;
  event: EventBridgeEventEnvelope<TDetail>;
  context: Context;
}

export type EventBridgeHandler<TDetail = unknown> = (request: EventBridgeRequest<TDetail>) => Promise<void>;

export interface EventBridgeFilterInput {
  event: unknown;
  source: string;
  detailType: string;
  detail: unknown;
}

export interface EventBridgeFilters {
  sources?: string[];
  detailTypes?: string[];
  accounts?: string[];
  regions?: string[];
  resources?: string[];
  customFilter?: (input: EventBridgeFilterInput) => boolean;
}

export interface EventBridgeRouteDefinition<TDetail = unknown> {
  filters: EventBridgeFilters;
  detailSchema?: Schema<TDetail>;
  handler: EventBridgeHandler<TDetail>;
}
