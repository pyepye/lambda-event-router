import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { KafkaFilters, KafkaRequest, KafkaRouteDefinition } from './types.js';

export interface InternalRoute {
  filters: KafkaFilters;
  valueSchema?: StandardSchemaV1;
  handler: (request: KafkaRequest) => Promise<void>;
}

export interface RouteInput<TValueSchema extends StandardSchemaV1 | undefined = undefined> {
  filters: KafkaFilters;
  valueSchema?: TValueSchema;
}

export interface RouteBuilder<TValue> {
  handle(handler: (request: KafkaRequest<TValue>) => Promise<void>): KafkaRouteDefinition<TValue>;
}
