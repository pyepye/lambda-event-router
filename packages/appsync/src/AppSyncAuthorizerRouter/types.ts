import type { AppSyncAuthorizerEvent, AppSyncAuthorizerResult, Context } from 'aws-lambda';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

export type AppSyncAuthorizerResponse = AppSyncAuthorizerResult<Record<string, unknown>>;

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

export interface AppSyncAuthorizerFilterInput {
  apiId: string;
  operationName: string | undefined;
  event: AppSyncAuthorizerEvent;
}

export interface AppSyncAuthorizerFilters {
  apiId?: FilterStringMatcher;
  operationName?: FilterStringMatcher;
  custom?: (input: AppSyncAuthorizerFilterInput) => boolean | Promise<boolean>;
}

export type AppSyncAuthorizerHandler = (request: AppSyncAuthorizerRequest) => Promise<AppSyncAuthorizerResponse>;

export type AppSyncAuthorizerMiddleware = Middleware<AppSyncAuthorizerRequest, AppSyncAuthorizerResponse>;

export interface AppSyncAuthorizerRouteDefinition {
  filters?: AppSyncAuthorizerFilters;
  middleware?: AppSyncAuthorizerMiddleware[];
  handler: AppSyncAuthorizerHandler;
}

export interface AppSyncAuthorizerRouteInput {
  filters?: AppSyncAuthorizerFilters;
  middleware?: AppSyncAuthorizerMiddleware[];
}

export interface AppSyncAuthorizerRouterOptions {
  middleware?: AppSyncAuthorizerMiddleware[];
}

export interface AppSyncAuthorizerRouteBuilder {
  handle(handler: AppSyncAuthorizerHandler): AppSyncAuthorizerRouteDefinition;
}

export interface InternalAuthorizerRoute {
  filters: AppSyncAuthorizerFilters;
  middleware?: AppSyncAuthorizerMiddleware[];
  handler: AppSyncAuthorizerHandler;
}
