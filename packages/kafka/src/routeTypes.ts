import type { Schema } from '@lambda-event-router/base';
import type { KafkaFilters, KafkaRequest, KafkaRouteDefinition } from './types.js';

export interface InternalRoute {
  filters: KafkaFilters;
  valueSchema?: Schema<unknown>;
  handler: (request: KafkaRequest) => Promise<void>;
}

export interface RouteInput<TValueSchema extends Schema<unknown> | undefined = undefined> {
  filters: KafkaFilters;
  valueSchema?: TValueSchema;
}

export interface RouteBuilder<TValue> {
  handle(handler: (request: KafkaRequest<TValue>) => Promise<void>): KafkaRouteDefinition<TValue>;
}
