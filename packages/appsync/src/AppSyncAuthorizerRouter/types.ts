import type { AppSyncAuthorizerEvent, AppSyncAuthorizerResult, Context } from 'aws-lambda';

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

export interface AppSyncAuthorizerRouteDefinition {
  handler: (request: AppSyncAuthorizerRequest) => Promise<AppSyncAuthorizerResponse>;
}

export interface AppSyncAuthorizerRouteBuilder {
  handle(
    handler: (request: AppSyncAuthorizerRequest) => Promise<AppSyncAuthorizerResponse>,
  ): AppSyncAuthorizerRouteDefinition;
}
