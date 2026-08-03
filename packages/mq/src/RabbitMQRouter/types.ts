import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

// --- AWS Event Types (not in @types/aws-lambda) ---

// Amazon MQ delivers a string header as its UTF-8 bytes. A timestamp header is the only plain string.
export type RabbitMQHeaderValue =
  | { bytes: number[] }
  | string
  | number
  | boolean
  | null
  | RabbitMQHeaderValue[]
  | { [key: string]: RabbitMQHeaderValue };

// An AMQP property the publisher does not set arrives as null rather than as a default, so every field
// a publisher may leave out is nullable.
export interface RabbitMQBasicProperties {
  contentType: string | null;
  contentEncoding: string | null;
  headers: Record<string, RabbitMQHeaderValue>;
  deliveryMode: number | null;
  priority: number | null;
  correlationId: string | null;
  replyTo: string | null;
  expiration: string | null;
  messageId: string | null;
  timestamp: string | null;
  type: string | null;
  userId: string | null;
  appId: string | null;
  clusterId: string | null;
  bodySize: number;
}

export interface RabbitMQMessage {
  basicProperties: RabbitMQBasicProperties;
  data: string;
  redelivered: boolean;
}

export interface RabbitMQEvent {
  eventSource: 'aws:rmq';
  eventSourceArn: string;
  rmqMessagesByQueue: Record<string, RabbitMQMessage[]>;
}

// --- Request Type ---

export interface RabbitMQRequest<TBody = unknown> {
  message: RabbitMQMessage;
  queue: string;
  virtualHost: string | undefined;
  body: TBody;
  timestamp: Date | null;
  record: RabbitMQMessage;
  context: Context;
}

// --- Filter Types ---

export interface RabbitMQFilterInput {
  queue: string;
  virtualHost: string | undefined;
  contentType: string | null;
  timestamp: Date | null;
  message: RabbitMQMessage;
  record: RabbitMQMessage;
}

export interface RabbitMQFilters {
  eventSourceArn?: FilterStringMatcher;
  queue?: FilterStringMatcher;
  virtualHost?: FilterStringMatcher;
  contentType?: FilterStringMatcher;
  custom?: (input: RabbitMQFilterInput) => boolean | Promise<boolean>;
}

// --- Route Definition Types ---

export type RabbitMQMiddleware<TBody = unknown> = Middleware<RabbitMQRequest<TBody>, void>;

export interface RabbitMQRouteDefinition<TBody = unknown> {
  filters: RabbitMQFilters;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  middleware?: RabbitMQMiddleware<NoInfer<TBody>>[];
  handler: (request: RabbitMQRequest<TBody>) => Promise<void>;
}

// --- Internal Route Type ---

export interface RabbitMQInternalRoute {
  filters: RabbitMQFilters;
  bodySchema?: StandardSchemaV1;
  middleware?: RabbitMQMiddleware[];
  handler: (request: RabbitMQRequest) => Promise<void>;
}

// --- Route Builder Types ---

export interface RabbitMQRouteInput<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
> {
  filters: RabbitMQFilters;
  middleware?: RabbitMQMiddleware<TBody>[];
  bodySchema?: TBodySchema;
}

export interface RabbitMQRouteBuilder<TBody> {
  handle(handler: (request: RabbitMQRequest<TBody>) => Promise<void>): RabbitMQRouteDefinition<TBody>;
}

export interface RabbitMQRouterOptions {
  middleware?: RabbitMQMiddleware[];
}

export type RabbitMQResponse = undefined;
