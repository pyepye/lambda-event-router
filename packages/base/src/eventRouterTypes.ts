import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from 'aws-lambda';

export interface EventFilterInput<TPayload = unknown> {
  event: TPayload;
}

export interface EventFilters<TPayload = unknown> {
  customFilter?: (input: EventFilterInput<TPayload>) => boolean;
}

export interface EventRequest<TPayload = unknown> {
  event: TPayload;
  context: Context;
}

export interface EventRouteDefinition<TPayload = unknown> {
  filters: EventFilters<TPayload>;
  eventSchema?: StandardSchemaV1<unknown, TPayload>;
  handler: EventHandler<TPayload>;
}

export type EventHandler<TPayload = unknown> = (request: EventRequest<TPayload>) => Promise<void>;
