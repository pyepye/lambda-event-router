import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from 'aws-lambda';

import type { Middleware } from '../middleware';

export interface EventFilterInput<TPayload = unknown> {
  event: TPayload;
}

export interface EventFilters<TPayload = unknown> {
  customFilter?: (input: EventFilterInput<TPayload>) => boolean | Promise<boolean>;
}

export type EventRouterMiddleware<TPayload = unknown, TResponse = unknown> = Middleware<
  EventRequest<TPayload>,
  TResponse
>;

export interface EventRequest<TPayload = unknown> {
  event: TPayload;
  context: Context;
}

export interface EventRouteDefinition<TPayload = unknown, TResponse = unknown> {
  filters: EventFilters<TPayload>;
  eventSchema?: StandardSchemaV1<unknown, TPayload>;
  middleware?: EventRouterMiddleware<TPayload, TResponse>[];
  handler: EventHandler<TPayload, TResponse>;
}

export type EventHandler<TPayload = unknown, TResponse = unknown> = (
  request: EventRequest<TPayload>,
) => Promise<TResponse>;
