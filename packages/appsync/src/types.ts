import type { Schema } from '@lambda-event-router/base';
import type {
  AppSyncAuthorizerEvent,
  AppSyncAuthorizerResult,
  AppSyncIdentity,
  AppSyncResolverEvent,
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
  context: import('aws-lambda').Context;
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

export interface AppSyncResolverRouteDefinition<TArgs = Record<string, unknown>> {
  filters: AppSyncResolverFilters;
  argumentsSchema?: Schema<TArgs>;
  handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>;
}

export interface AppSyncQueryInput<TArgs = Record<string, unknown>> {
  fieldName: string;
  argumentsSchema?: Schema<TArgs>;
  handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>;
}

export interface AppSyncMutationInput<TArgs = Record<string, unknown>> {
  fieldName: string;
  argumentsSchema?: Schema<TArgs>;
  handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>;
}

export interface AppSyncSubscriptionInput<TArgs = Record<string, unknown>> {
  fieldName: string;
  argumentsSchema?: Schema<TArgs>;
  handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>;
}

// ─── Resolver Route Builder Types ────────────────────────────────────────────

export interface AppSyncResolverRouteInput<TArgumentsSchema extends Schema<unknown> | undefined = undefined> {
  filters: AppSyncResolverFilters;
  argumentsSchema?: TArgumentsSchema;
}

export interface AppSyncResolverRouteBuilder<TArgs> {
  handle(handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>): AppSyncResolverRouteDefinition<TArgs>;
}

// ─── Internal Resolver Route ─────────────────────────────────────────────────

export interface InternalResolverRoute {
  filters: AppSyncResolverFilters;
  argumentsSchema?: Schema<unknown>;
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
  context: import('aws-lambda').Context;
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
  context: import('aws-lambda').Context;
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

export interface AppSyncPublishInput {
  channelNamespace: string;
  handler: (request: AppSyncEventsRequest) => Promise<unknown>;
}

export interface AppSyncSubscribeInput {
  channelNamespace: string;
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
