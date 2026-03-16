import type { Context } from 'aws-lambda';
import type { Schema } from './types.js';

export interface EventFilterInput {
  event: unknown;
}

export interface EventFilters {
  customFilter?: (input: EventFilterInput) => boolean;
}

export interface EventRequest<TPayload = unknown> {
  event: TPayload;
  context: Context;
}

export interface EventRouteDefinition<TPayload = unknown> {
  filters: EventFilters;
  eventSchema?: Schema<TPayload>;
  handler: EventHandler<TPayload>;
}

export type EventHandler<TPayload = unknown> = (request: EventRequest<TPayload>) => Promise<void>;
