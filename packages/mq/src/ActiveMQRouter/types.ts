import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { Middleware } from '@lambda-event-router/base';

// --- AWS Event Types (not in @types/aws-lambda) ---

export type ActiveMQMessageType = 'jms/text-message' | 'jms/bytes-message';

export interface ActiveMQDestination {
  physicalName: string;
}

export interface ActiveMQMessage {
  messageID: string;
  messageType: ActiveMQMessageType;
  timestamp: number;
  deliveryMode: number;
  correlationID: string;
  replyTo: string | null;
  destination: ActiveMQDestination;
  redelivered: boolean;
  type: string;
  expiration: number;
  priority: number;
  data: string;
  brokerInTime: number;
  brokerOutTime: number;
  properties: Record<string, unknown>;
}

export interface ActiveMQEvent {
  eventSource: 'aws:mq';
  eventSourceArn: string;
  messages: ActiveMQMessage[];
}

// --- Request Types ---

interface ActiveMQRequestBase<TBody = unknown> {
  message: ActiveMQMessage;
  destination: string;
  body: TBody;
  record: ActiveMQMessage;
  context: Context;
}

export interface ActiveMQTextMessageRequest<TBody = unknown> extends ActiveMQRequestBase<TBody> {
  messageType: 'jms/text-message';
}

export interface ActiveMQBytesMessageRequest<TBody = unknown> extends ActiveMQRequestBase<TBody> {
  messageType: 'jms/bytes-message';
}

export type ActiveMQRequest<TBody = unknown> = ActiveMQTextMessageRequest<TBody> | ActiveMQBytesMessageRequest<TBody>;

// --- Filter Types ---

export interface ActiveMQFilterInput {
  messageType: ActiveMQMessageType;
  destination: string;
  record: ActiveMQMessage;
}

export interface ActiveMQFilters {
  eventSourceArn?: string | string[];
  destination?: string | string[];
  messageType?: ActiveMQMessageType | (string & {}) | (ActiveMQMessageType | (string & {}))[];
  customFilter?: (input: ActiveMQFilterInput) => boolean | Promise<boolean>;
}

// --- Handler Types ---

export type ActiveMQMiddleware = Middleware<ActiveMQRequest, void>;

type ActiveMQRecordHandler<TBody = unknown> =
  | ((request: ActiveMQRequest<TBody>) => Promise<void>)
  | ((request: ActiveMQTextMessageRequest<TBody>) => Promise<void>)
  | ((request: ActiveMQBytesMessageRequest<TBody>) => Promise<void>);

// --- Route Definition Types ---

export interface ActiveMQRouteDefinition<TBody = unknown> {
  filters: ActiveMQFilters;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  middleware?: ActiveMQMiddleware[];
  handler: ActiveMQRecordHandler<TBody>;
}

export interface ActiveMQTextMessageRouteDefinition<TBody = unknown> {
  filters: Omit<ActiveMQFilters, 'messageType'>;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  middleware?: ActiveMQMiddleware[];
  handler: (request: ActiveMQTextMessageRequest<TBody>) => Promise<void>;
}

export interface ActiveMQBytesMessageRouteDefinition<TBody = unknown> {
  filters: Omit<ActiveMQFilters, 'messageType'>;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  middleware?: ActiveMQMiddleware[];
  handler: (request: ActiveMQBytesMessageRequest<TBody>) => Promise<void>;
}

// --- Internal Route Type ---

export interface ActiveMQInternalRoute {
  filters: ActiveMQFilters;
  bodySchema?: StandardSchemaV1;
  middleware?: ActiveMQMiddleware[];
  handler: (request: ActiveMQRequest) => Promise<void>;
}

// --- Route Builder Types ---

type MessageTypeToRequest<
  TMessageType extends ActiveMQMessageType | undefined,
  TBody,
> = TMessageType extends 'jms/text-message'
  ? ActiveMQTextMessageRequest<TBody>
  : TMessageType extends 'jms/bytes-message'
    ? ActiveMQBytesMessageRequest<TBody>
    : ActiveMQRequest<TBody>;

export interface ActiveMQRouteInput<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TMessageType extends ActiveMQMessageType | undefined = undefined,
> {
  filters: Omit<ActiveMQFilters, 'messageType'> & {
    messageType?: TMessageType | (string & {}) | (TMessageType | (string & {}))[];
  };
  middleware?: ActiveMQMiddleware[];
  bodySchema?: TBodySchema;
}

export interface ActiveMQRouteBuilder<TBody, TMessageType extends ActiveMQMessageType | undefined> {
  handle(
    handler: (request: MessageTypeToRequest<TMessageType, TBody>) => Promise<void>,
  ): ActiveMQRouteDefinition<TBody>;
}

export interface ActiveMQRouterOptions {
  middleware?: ActiveMQMiddleware[];
}

export type ActiveMQResponse = undefined;
