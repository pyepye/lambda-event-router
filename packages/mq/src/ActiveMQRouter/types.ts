import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

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

interface ActiveMQRequestBase {
  message: ActiveMQMessage;
  destination: string;
  record: ActiveMQMessage;
  context: Context;
}

export interface ActiveMQTextMessageRequest<TBody = unknown> extends ActiveMQRequestBase {
  messageType: 'jms/text-message';
  body: TBody;
}

// A bytes message carries binary, so its body is the raw bytes decoded from base64.
export interface ActiveMQBytesMessageRequest extends ActiveMQRequestBase {
  messageType: 'jms/bytes-message';
  body: Buffer;
}

export type ActiveMQRequest<TBody = unknown> = ActiveMQTextMessageRequest<TBody> | ActiveMQBytesMessageRequest;

// --- Filter Types ---

export interface ActiveMQFilterInput {
  messageType: ActiveMQMessageType;
  destination: string;
  record: ActiveMQMessage;
}

export interface ActiveMQFilters {
  eventSourceArn?: FilterStringMatcher;
  destination?: FilterStringMatcher;
  messageType?: ActiveMQMessageType | ActiveMQMessageType[];
  custom?: (input: ActiveMQFilterInput) => boolean | Promise<boolean>;
}

// --- Handler Types ---

export type ActiveMQMiddleware = Middleware<ActiveMQRequest, void>;

// --- Route Definition Types ---

// The handler request narrows from the `messageType` filter: a route with no `messageType` takes the
// union, and a route pinned to one type takes that one, so a handler cannot claim a type the route did
// not filter for. A bytes route's body is a Buffer; `defineActiveMQRoute` rejects a bodySchema on one.
export interface ActiveMQRouteDefinition<
  TBody = unknown,
  TMessageType extends ActiveMQMessageType | undefined = undefined,
> {
  filters: Omit<ActiveMQFilters, 'messageType'> & {
    messageType?: TMessageType | TMessageType[];
  };
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  middleware?: ActiveMQMiddleware[];
  handler: (request: MessageTypeToRequest<TMessageType, TBody>) => Promise<void>;
}

export interface ActiveMQTextMessageRouteDefinition<TBody = unknown> {
  filters: Omit<ActiveMQFilters, 'messageType'>;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  middleware?: ActiveMQMiddleware[];
  handler: (request: ActiveMQTextMessageRequest<TBody>) => Promise<void>;
}

// A bytes message body is a Buffer, so there is no JSON to validate and no bodySchema.
export interface ActiveMQBytesMessageRouteDefinition {
  filters: Omit<ActiveMQFilters, 'messageType'>;
  middleware?: ActiveMQMiddleware[];
  handler: (request: ActiveMQBytesMessageRequest) => Promise<void>;
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
    ? ActiveMQBytesMessageRequest
    : ActiveMQRequest<TBody>;

export type ActiveMQRouteInput<TBody = unknown, TMessageType extends ActiveMQMessageType | undefined = undefined> = {
  filters: Omit<ActiveMQFilters, 'messageType'> & {
    messageType?: TMessageType | TMessageType[];
  };
  middleware?: ActiveMQMiddleware[];
} & ([TMessageType] extends ['jms/bytes-message']
  ? { bodySchema?: never }
  : { bodySchema?: StandardSchemaV1<unknown, TBody> });

export interface ActiveMQRouteBuilder<TBody, TMessageType extends ActiveMQMessageType | undefined> {
  handle(
    handler: (request: MessageTypeToRequest<TMessageType, TBody>) => Promise<void>,
  ): ActiveMQRouteDefinition<TBody, TMessageType>;
}

export interface ActiveMQRouterOptions {
  middleware?: ActiveMQMiddleware[];
}

export type ActiveMQResponse = undefined;
