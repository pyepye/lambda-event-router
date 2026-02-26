import type { Schema } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';

export interface EventBridgeSchedulerFilterInput {
  event: unknown;
}

export interface EventBridgeSchedulerFilters {
  customFilter?: (input: EventBridgeSchedulerFilterInput) => boolean;
}

export interface EventBridgeSchedulerRequest<TPayload = unknown> {
  event: TPayload;
  context: Context;
}

export interface EventBridgeSchedulerRouteDefinition<TPayload = unknown> {
  filters: EventBridgeSchedulerFilters;
  eventSchema?: Schema<TPayload>;
  handler: EventBridgeSchedulerHandler<TPayload>;
}

export type EventBridgeSchedulerHandler<TPayload = unknown> = (
  request: EventBridgeSchedulerRequest<TPayload>,
) => Promise<void>;
