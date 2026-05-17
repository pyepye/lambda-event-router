import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

// --- AWS Event Types (not in @types/aws-lambda) ---

export interface RabbitMQBasicProperties {
  contentType: string;
  contentEncoding: string | null;
  headers: Record<string, unknown>;
  deliveryMode: number;
  priority: number;
  correlationId: string | null;
  replyTo: string | null;
  expiration: string;
  messageId: string | null;
  timestamp: string;
  type: string | null;
  userId: string;
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
  record: RabbitMQMessage;
  context: Context;
}

// --- Filter Types ---

export interface RabbitMQFilterInput {
  queue: string;
  virtualHost: string | undefined;
  contentType: string;
  record: RabbitMQMessage;
}

export interface RabbitMQFilters {
  eventSourceArn?: FilterStringMatcher;
  queue?: FilterStringMatcher;
  virtualHost?: FilterStringMatcher;
  contentType?: FilterStringMatcher;
  customFilter?: (input: RabbitMQFilterInput) => boolean | Promise<boolean>;
}

// --- Route Definition Types ---

export type RabbitMQMiddleware = Middleware<RabbitMQRequest, void>;

export interface RabbitMQRouteDefinition<TBody = unknown> {
  filters: RabbitMQFilters;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  middleware?: RabbitMQMiddleware[];
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

export interface RabbitMQRouteInput<TBodySchema extends StandardSchemaV1 | undefined = undefined> {
  filters: RabbitMQFilters;
  middleware?: RabbitMQMiddleware[];
  bodySchema?: TBodySchema;
}

export interface RabbitMQRouteBuilder<TBody> {
  handle(handler: (request: RabbitMQRequest<TBody>) => Promise<void>): RabbitMQRouteDefinition<TBody>;
}

export interface RabbitMQRouterOptions {
  middleware?: RabbitMQMiddleware[];
}

export type RabbitMQResponse = undefined;
