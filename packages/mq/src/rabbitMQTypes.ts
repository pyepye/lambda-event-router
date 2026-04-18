import type { Middleware } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from 'aws-lambda';

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
  body: TBody;
  record: RabbitMQMessage;
  context: Context;
}

// --- Filter Types ---

export interface RabbitMQFilterInput {
  queue: string;
  contentType: string;
  record: RabbitMQMessage;
}

export interface RabbitMQFilters {
  eventSourceArn?: string | string[];
  queue?: string | string[];
  contentType?: string | string[];
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
  filters: {
    eventSourceArn?: string | string[];
    queue?: string | string[];
    contentType?: string | string[];
    customFilter?: (input: RabbitMQFilterInput) => boolean | Promise<boolean>;
  };
  middleware?: RabbitMQMiddleware[];
  bodySchema?: TBodySchema;
}

export interface RabbitMQRouteBuilder<TBody> {
  handle(handler: (request: RabbitMQRequest<TBody>) => Promise<void>): RabbitMQRouteDefinition<TBody>;
}

export interface RabbitMQRouterOptions {
  middleware?: RabbitMQMiddleware[];
}
