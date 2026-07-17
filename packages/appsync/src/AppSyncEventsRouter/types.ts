import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, JsonValue, Middleware } from '@lambda-event-router/base';

export type AppSyncEventsOperation = 'PUBLISH' | 'SUBSCRIBE';

// AppSync refuses a publish whose event is not a stringified JSON value, so a handler is only ever
// given one it has already parsed.
export interface AppSyncEventsPublishedEvent<TPayload = JsonValue> {
  id: string;
  payload: TPayload;
}

// An entry carrying both is accepted and AppSync drops the payload, and one carrying neither answers
// 502, so the two arms are kept apart.
export type AppSyncEventsOutgoingEvent =
  | { id: string; payload: JsonValue; error?: never }
  | { id: string; payload?: never; error: string };

// A result carrying neither answers 502, and a top level error is returned to the publisher as a 403.
export type AppSyncEventsPublishResult =
  | { events: AppSyncEventsOutgoingEvent[]; error?: never }
  | { events?: never; error: string };

export type AppSyncEventsSubscribeResult = { error: string } | null;

export interface AppSyncEventsIdentity {
  sub?: string;
  issuer?: string;
  username?: string;
  claims?: Record<string, unknown>;
  sourceIp?: string[];
  groups?: string[] | null;
  [key: string]: unknown;
}

export interface AppSyncEventsEvent {
  identity: AppSyncEventsIdentity | null | undefined;
  request: {
    headers: Record<string, string | undefined>;
    domainName: string | null;
  };
  info: {
    channel: {
      path: string;
      segments: string[];
    };
    channelNamespace: {
      name: string;
    };
    operation: AppSyncEventsOperation;
  };
  stash: Record<string, unknown>;
  events: AppSyncEventsPublishedEvent[] | null;
  prev: { result: Record<string, unknown> } | null;
  result: unknown;
  error: unknown;
  outErrors: unknown[];
}

export interface AppSyncEventsRequest<TPayload = JsonValue> {
  channelPath: string;
  channelNamespace: string;
  operation: AppSyncEventsOperation;
  identity: AppSyncEventsIdentity | null | undefined;
  events: AppSyncEventsPublishedEvent<TPayload>[];
  info: AppSyncEventsEvent['info'];
  request: AppSyncEventsEvent['request'];
  stash: Record<string, unknown>;
  prev: AppSyncEventsEvent['prev'];
  event: AppSyncEventsEvent;
  context: Context;
}

export interface AppSyncEventsFilterInput {
  operation: AppSyncEventsOperation;
  channelNamespace: string;
  channelPath: string;
  event: AppSyncEventsEvent;
}

export interface AppSyncEventsFilters {
  operation?: AppSyncEventsOperation | AppSyncEventsOperation[];
  channelPath?: FilterStringMatcher;
  channelNamespace?: FilterStringMatcher;
  custom?: (input: AppSyncEventsFilterInput) => boolean | Promise<boolean>;
}

// Middleware is invariant in its request and also registers router-wide, where no route's schema
// applies, so it sees the unvalidated payload.
export type AppSyncEventsMiddleware = Middleware<AppSyncEventsRequest, unknown>;

export interface AppSyncEventsRouteDefinition<TPayload = JsonValue> {
  filters: AppSyncEventsFilters;
  payloadSchema?: StandardSchemaV1;
  middleware?: AppSyncEventsMiddleware[];
  handler: (request: AppSyncEventsRequest<TPayload>) => Promise<unknown>;
}

export type PayloadOf<TPayloadSchema> = TPayloadSchema extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<TPayloadSchema>
  : JsonValue;

export type AppSyncEventsOperationFilters = Pick<AppSyncEventsFilters, 'custom'>;

export interface AppSyncEventsChannelInput<TPayloadSchema extends StandardSchemaV1 | undefined = undefined> {
  channelPath: FilterStringMatcher;
  filters?: AppSyncEventsOperationFilters;
  payloadSchema?: TPayloadSchema;
  middleware?: AppSyncEventsMiddleware[];
  handler: (request: AppSyncEventsRequest<PayloadOf<TPayloadSchema>>) => Promise<unknown>;
}

export type AppSyncPublishInput<TPayloadSchema extends StandardSchemaV1 | undefined = undefined> =
  AppSyncEventsChannelInput<TPayloadSchema>;
export type AppSyncSubscribeInput<TPayloadSchema extends StandardSchemaV1 | undefined = undefined> =
  AppSyncEventsChannelInput<TPayloadSchema>;

export interface AppSyncEventsRouteInput<TPayloadSchema extends StandardSchemaV1 | undefined = undefined> {
  filters?: AppSyncEventsFilters;
  payloadSchema?: TPayloadSchema;
  middleware?: AppSyncEventsMiddleware[];
}

export interface AppSyncEventsRouterOptions {
  middleware?: AppSyncEventsMiddleware[];
}

export interface AppSyncEventsRouteBuilder<TPayload = JsonValue> {
  handle(
    handler: (request: AppSyncEventsRequest<TPayload>) => Promise<unknown>,
  ): AppSyncEventsRouteDefinition<TPayload>;
}

export interface InternalEventsRoute {
  filters: AppSyncEventsFilters;
  payloadSchema?: StandardSchemaV1;
  middleware?: AppSyncEventsMiddleware[];
  handler: (request: AppSyncEventsRequest) => Promise<unknown>;
}
