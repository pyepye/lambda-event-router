import type { Context } from 'aws-lambda';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

export type AppSyncEventsAuthorizerOperation = 'EVENT_CONNECT' | 'EVENT_PUBLISH' | 'EVENT_SUBSCRIBE';

export interface AppSyncEventsAuthorizerEvent {
  authorizationToken: string;
  requestContext: {
    apiId: string;
    accountId: string;
    requestId: string;
    operation: AppSyncEventsAuthorizerOperation;
    // Both are left off an EVENT_CONNECT: the client names no channel until it publishes or
    // subscribes. AppSync documents them as null, and sends an event without the keys.
    channelNamespaceName?: string;
    channel?: string;
  };
  requestHeaders: Record<string, string | undefined>;
}

export interface AppSyncEventsAuthorizerBaseRequest {
  authorizationToken: string;
  requestHeaders: Record<string, string | undefined>;
  apiId: string;
  accountId: string;
  requestId: string;
  operation: AppSyncEventsAuthorizerOperation;
  event: AppSyncEventsAuthorizerEvent;
  context: Context;
}

// A connect names no channel, so there is nothing to add.
export type AppSyncEventsAuthorizerConnectRequest = AppSyncEventsAuthorizerBaseRequest;

export interface AppSyncEventsAuthorizerChannelRequest extends AppSyncEventsAuthorizerBaseRequest {
  channelPath: string;
  channelNamespace: string;
}

// What a route with hand-written filters receives, since those filters may take either operation.
export interface AppSyncEventsAuthorizerRequest extends AppSyncEventsAuthorizerBaseRequest {
  channelPath?: string;
  channelNamespace?: string;
}

// An Event API reads `handlerContext` and nothing else. `resolverContext` and `deniedFields` belong
// to a GraphQL API and are dropped without an error.
export interface AppSyncEventsAuthorizerResponse {
  isAuthorized: boolean;
  handlerContext?: Record<string, unknown>;
  ttlOverride?: number;
}

export interface AppSyncEventsAuthorizerFilterInput {
  operation: AppSyncEventsAuthorizerOperation;
  channelPath: string | undefined;
  channelNamespace: string | undefined;
  event: AppSyncEventsAuthorizerEvent;
}

export interface AppSyncEventsAuthorizerFilters {
  operation?: AppSyncEventsAuthorizerOperation | AppSyncEventsAuthorizerOperation[];
  channelPath?: FilterStringMatcher;
  channelNamespace?: FilterStringMatcher;
  custom?: (input: AppSyncEventsAuthorizerFilterInput) => boolean | Promise<boolean>;
}

export type AppSyncEventsAuthorizerMiddleware<TRequest = AppSyncEventsAuthorizerRequest> = Middleware<
  TRequest,
  AppSyncEventsAuthorizerResponse
>;

export type AppSyncEventsAuthorizerHandler<TRequest = AppSyncEventsAuthorizerRequest> = (
  request: TRequest,
) => Promise<AppSyncEventsAuthorizerResponse>;

export interface AppSyncEventsAuthorizerRouteDefinition {
  filters?: AppSyncEventsAuthorizerFilters;
  middleware?: AppSyncEventsAuthorizerMiddleware[];
  handler: AppSyncEventsAuthorizerHandler;
}

export type AppSyncEventsAuthorizerChannelFilters = Pick<AppSyncEventsAuthorizerFilters, 'custom'>;

export interface AppSyncEventsAuthorizerChannelInput {
  channelPath: FilterStringMatcher;
  filters?: AppSyncEventsAuthorizerChannelFilters;
  middleware?: AppSyncEventsAuthorizerMiddleware<AppSyncEventsAuthorizerChannelRequest>[];
  handler: AppSyncEventsAuthorizerHandler<AppSyncEventsAuthorizerChannelRequest>;
}

export interface AppSyncEventsAuthorizerConnectInput {
  filters?: AppSyncEventsAuthorizerChannelFilters;
  middleware?: AppSyncEventsAuthorizerMiddleware<AppSyncEventsAuthorizerConnectRequest>[];
  handler: AppSyncEventsAuthorizerHandler<AppSyncEventsAuthorizerConnectRequest>;
}

export interface AppSyncEventsAuthorizerRouteInput<
  TOperation extends AppSyncEventsAuthorizerFilters['operation'] = AppSyncEventsAuthorizerFilters['operation'],
> {
  filters?: Omit<AppSyncEventsAuthorizerFilters, 'operation'> & { operation?: TOperation };
  middleware?: AppSyncEventsAuthorizerMiddleware<InferAuthorizerRequest<TOperation>>[];
}

export interface AppSyncEventsAuthorizerRouterOptions {
  middleware?: AppSyncEventsAuthorizerMiddleware[];
}

export interface AppSyncEventsAuthorizerRouteBuilder<TRequest = AppSyncEventsAuthorizerRequest> {
  handle(handler: AppSyncEventsAuthorizerHandler<TRequest>): AppSyncEventsAuthorizerRouteDefinition;
}

// The operation filter says which shape of request the route can receive, the way the `type` filter
// does on the API Gateway authorizer.
type OperationsOf<T> = T extends readonly (infer TItem)[] ? TItem : T;

export type InferAuthorizerRequest<TOperation> = [OperationsOf<TOperation>] extends ['EVENT_CONNECT']
  ? AppSyncEventsAuthorizerConnectRequest
  : [OperationsOf<TOperation>] extends ['EVENT_PUBLISH' | 'EVENT_SUBSCRIBE']
    ? AppSyncEventsAuthorizerChannelRequest
    : AppSyncEventsAuthorizerRequest;

export interface InternalEventsAuthorizerRoute {
  filters: AppSyncEventsAuthorizerFilters;
  middleware?: AppSyncEventsAuthorizerMiddleware[];
  handler: AppSyncEventsAuthorizerHandler;
}
