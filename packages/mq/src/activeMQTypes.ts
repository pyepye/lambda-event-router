import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from 'aws-lambda';

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
  eventSourceArns?: string[];
  destinations?: string[];
  messageTypes?: ActiveMQMessageType[];
  customFilter?: (input: ActiveMQFilterInput) => boolean;
}

export interface ActiveMQMessageTypeFilters {
  eventSourceArns?: string[];
  destinations?: string[];
  customFilter?: (input: ActiveMQFilterInput) => boolean;
}

// --- Handler Types ---

type ActiveMQRecordHandler<TBody = unknown> =
  | ((request: ActiveMQRequest<TBody>) => Promise<void>)
  | ((request: ActiveMQTextMessageRequest<TBody>) => Promise<void>)
  | ((request: ActiveMQBytesMessageRequest<TBody>) => Promise<void>);

// --- Route Definition Types ---

export interface ActiveMQRouteDefinition<TBody = unknown> {
  filters: ActiveMQFilters;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  handler: ActiveMQRecordHandler<TBody>;
}

export interface ActiveMQTextMessageRouteDefinition<TBody = unknown> {
  filters: ActiveMQMessageTypeFilters;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  handler: (request: ActiveMQTextMessageRequest<TBody>) => Promise<void>;
}

export interface ActiveMQBytesMessageRouteDefinition<TBody = unknown> {
  filters: ActiveMQMessageTypeFilters;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  handler: (request: ActiveMQBytesMessageRequest<TBody>) => Promise<void>;
}

// --- Internal Route Type ---

export interface ActiveMQInternalRoute {
  filters: ActiveMQFilters;
  bodySchema?: StandardSchemaV1;
  handler: (request: ActiveMQRequest) => Promise<void>;
}

// --- Route Builder Types ---

type MessageTypeToRequest<
  TMessageTypes extends readonly ActiveMQMessageType[] | undefined,
  TBody,
> = TMessageTypes extends readonly ['jms/text-message']
  ? ActiveMQTextMessageRequest<TBody>
  : TMessageTypes extends readonly ['jms/bytes-message']
    ? ActiveMQBytesMessageRequest<TBody>
    : ActiveMQRequest<TBody>;

export interface ActiveMQRouteInput<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TMessageTypes extends readonly ActiveMQMessageType[] | undefined = undefined,
> {
  filters: {
    eventSourceArns?: string[];
    destinations?: string[];
    messageTypes?: TMessageTypes;
    customFilter?: (input: ActiveMQFilterInput) => boolean;
  };
  bodySchema?: TBodySchema;
}

export interface ActiveMQRouteBuilder<TBody, TMessageTypes extends readonly ActiveMQMessageType[] | undefined> {
  handle(
    handler: (request: MessageTypeToRequest<TMessageTypes, TBody>) => Promise<void>,
  ): ActiveMQRouteDefinition<TBody>;
}
