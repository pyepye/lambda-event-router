import type { Context } from 'aws-lambda';
import type { Schema } from './types.js';

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
  eventSchema?: Schema<TPayload>;
  handler: EventHandler<TPayload>;
}

export type EventHandler<TPayload = unknown> = (request: EventRequest<TPayload>) => Promise<void>;
