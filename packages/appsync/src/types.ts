import type { Middleware } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
  AppSyncAuthorizerEvent,
  AppSyncAuthorizerResult,
  AppSyncIdentity,
  AppSyncResolverEvent,
  Context,
} from 'aws-lambda';
import type { AppSyncEventsEvent, AppSyncEventsIdentity, AppSyncEventsOperation } from './appSyncEventsTypes.js';

// ─── Resolver Types ──────────────────────────────────────────────────────────

export interface AppSyncResolverRequest<TArgs = Record<string, unknown>> {
  arguments: TArgs;
  identity: AppSyncIdentity;
  source: Record<string, unknown> | null;
  info: {
    selectionSetList: string[];
    selectionSetGraphQL: string;
    parentTypeName: string;
    fieldName: string;
    variables: Record<string, unknown>;
  };
  headers: Record<string, string | undefined>;
  domainName: string | null;
  prev: { result: Record<string, unknown> } | null;
  stash: Record<string, unknown>;
  event: AppSyncResolverEvent<TArgs>;
  context: Context;
}

export interface AppSyncResolverFilterInput {
  parentTypeName: string;
  fieldName: string;
  event: AppSyncResolverEvent<Record<string, unknown>>;
}

export interface AppSyncResolverFilters {
  parentTypeNames?: string[];
  fieldNames?: string[];
  customFilter?: (input: AppSyncResolverFilterInput) => boolean;
}

export type AppSyncResolverMiddleware<TArgs = Record<string, unknown>> = Middleware<
  AppSyncResolverRequest<TArgs>,
  unknown
>;

export interface AppSyncResolverRouteDefinition<TArgs = Record<string, unknown>> {
  filters: AppSyncResolverFilters;
  argumentsSchema?: StandardSchemaV1<unknown, TArgs>;
  middleware?: AppSyncResolverMiddleware<TArgs>[];
  handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>;
}

export interface AppSyncResolverFieldFilters {
  customFilter?: (input: AppSyncResolverFilterInput) => boolean;
}

export interface AppSyncQueryInput<TArgs = Record<string, unknown>> {
  fieldName: string;
  filters?: AppSyncResolverFieldFilters;
  argumentsSchema?: StandardSchemaV1<unknown, TArgs>;
  middleware?: AppSyncResolverMiddleware<TArgs>[];
  handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>;
}

export interface AppSyncMutationInput<TArgs = Record<string, unknown>> {
  fieldName: string;
  filters?: AppSyncResolverFieldFilters;
  argumentsSchema?: StandardSchemaV1<unknown, TArgs>;
  middleware?: AppSyncResolverMiddleware<TArgs>[];
  handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>;
}

export interface AppSyncSubscriptionInput<TArgs = Record<string, unknown>> {
  fieldName: string;
  filters?: AppSyncResolverFieldFilters;
  argumentsSchema?: StandardSchemaV1<unknown, TArgs>;
  middleware?: AppSyncResolverMiddleware<TArgs>[];
  handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>;
}

// ─── Resolver Route Builder Types ────────────────────────────────────────────

export interface AppSyncResolverRouteInput<
  TArgumentsSchema extends StandardSchemaV1 | undefined = undefined,
  TArgs = TArgumentsSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TArgumentsSchema>
    : Record<string, unknown>,
> {
  filters: AppSyncResolverFilters;
  argumentsSchema?: TArgumentsSchema;
  middleware?: AppSyncResolverMiddleware<TArgs>[];
}

export interface AppSyncResolverRouteBuilder<TArgs> {
  handle(handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>): AppSyncResolverRouteDefinition<TArgs>;
}

// ─── Internal Resolver Route ─────────────────────────────────────────────────

export interface InternalResolverRoute {
  filters: AppSyncResolverFilters;
  argumentsSchema?: StandardSchemaV1;
  middleware: Middleware<AppSyncResolverRequest, unknown>[];
  handler: (request: AppSyncResolverRequest) => Promise<unknown>;
}

// ─── Authorizer Types ────────────────────────────────────────────────────────

export interface AppSyncAuthorizerRequest {
  authorizationToken: string;
  requestHeaders: Record<string, string | undefined>;
  apiId: string;
  accountId: string;
  requestId: string;
  queryString: string;
  operationName: string | undefined;
  variables: Record<string, unknown>;
  event: AppSyncAuthorizerEvent;
  context: Context;
}

export interface AppSyncAuthorizerRouteDefinition {
  handler: (request: AppSyncAuthorizerRequest) => Promise<AppSyncAuthorizerResult<Record<string, unknown>>>;
}

export interface AppSyncAuthorizerRouteBuilder {
  handle(
    handler: (request: AppSyncAuthorizerRequest) => Promise<AppSyncAuthorizerResult<Record<string, unknown>>>,
  ): AppSyncAuthorizerRouteDefinition;
}

// ─── Events Types ────────────────────────────────────────────────────────────

export interface AppSyncEventsRequest {
  channel: string;
  channelNamespace: string;
  operation: AppSyncEventsOperation;
  identity: AppSyncEventsIdentity | null | undefined;
  events: Record<string, unknown>[];
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
  channel: string;
  event: AppSyncEventsEvent;
}

export interface AppSyncEventsFilters {
  operations?: AppSyncEventsOperation[];
  channelNamespaces?: string[];
  customFilter?: (input: AppSyncEventsFilterInput) => boolean;
}

export interface AppSyncEventsRouteDefinition {
  filters: AppSyncEventsFilters;
  handler: (request: AppSyncEventsRequest) => Promise<unknown>;
}

export interface AppSyncEventsOperationFilters {
  customFilter?: (input: AppSyncEventsFilterInput) => boolean;
}

export interface AppSyncPublishInput {
  channelNamespace: string;
  filters?: AppSyncEventsOperationFilters;
  handler: (request: AppSyncEventsRequest) => Promise<unknown>;
}

export interface AppSyncSubscribeInput {
  channelNamespace: string;
  filters?: AppSyncEventsOperationFilters;
  handler: (request: AppSyncEventsRequest) => Promise<unknown>;
}

// ─── Events Route Builder Types ──────────────────────────────────────────────

export interface AppSyncEventsRouteInput {
  filters?: AppSyncEventsFilters;
}

export interface AppSyncEventsRouteBuilder {
  handle(handler: (request: AppSyncEventsRequest) => Promise<unknown>): AppSyncEventsRouteDefinition;
}

// ─── Internal Events Route ───────────────────────────────────────────────────

export interface InternalEventsRoute {
  filters: AppSyncEventsFilters;
  handler: (request: AppSyncEventsRequest) => Promise<unknown>;
}
