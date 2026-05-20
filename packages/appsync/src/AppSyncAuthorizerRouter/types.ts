import type { AppSyncAuthorizerEvent, AppSyncAuthorizerResult, Context } from 'aws-lambda';

import type { Middleware } from '@lambda-event-router/base';

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

export type AppSyncAuthorizerMiddleware = Middleware<AppSyncAuthorizerRequest, AppSyncAuthorizerResponse>;

export interface AppSyncAuthorizerRouteDefinition {
  middleware?: AppSyncAuthorizerMiddleware[];
  handler: (request: AppSyncAuthorizerRequest) => Promise<AppSyncAuthorizerResponse>;
}

export interface AppSyncAuthorizerRouteInput {
  middleware?: AppSyncAuthorizerMiddleware[];
}

export interface AppSyncAuthorizerRouterOptions {
  middleware?: AppSyncAuthorizerMiddleware[];
}

export interface AppSyncAuthorizerRouteBuilder {
  handle(
    handler: (request: AppSyncAuthorizerRequest) => Promise<AppSyncAuthorizerResponse>,
  ): AppSyncAuthorizerRouteDefinition;
}
