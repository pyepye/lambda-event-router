import type {
  APIGatewayAuthorizerResult,
  APIGatewayEventRequestContextWithAuthorizer,
  APIGatewayRequestAuthorizerEvent,
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
  Context,
} from 'aws-lambda';

import type { JsonValue, Middleware } from '@lambda-event-router/base';

// A repeated header or query param reaches this authorizer as its last value alone: API Gateway sends
// neither multi-value map on payload format 1.0.
export interface HttpApiRequestAuthorizerEventV1 {
  version: '1.0';
  type: 'REQUEST';
  methodArn: string;
  identitySource: string;
  authorizationToken: string;
  resource: string;
  path: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters: Record<string, string | undefined>;
  pathParameters: Record<string, string | undefined>;
  stageVariables: Record<string, string | undefined>;
  requestContext: Omit<APIGatewayEventRequestContextWithAuthorizer<undefined>, 'authorizer'>;
}

export type LambdaAuthorizerEvent =
  | APIGatewayTokenAuthorizerEvent
  | APIGatewayRequestAuthorizerEvent
  | HttpApiRequestAuthorizerEventV1
  | APIGatewayRequestAuthorizerEventV2;

export type AuthorizerType = 'TOKEN' | 'REQUEST';

export interface LambdaAuthorizerFilters {
  type?: AuthorizerType;
  method?: string;
  custom?: (input: LambdaAuthorizerFilterInput) => boolean | Promise<boolean>;
}

export interface LambdaAuthorizerBaseRequest {
  type: AuthorizerType;
  resourceArn: string;
  event: LambdaAuthorizerEvent;
  context: Context;
}

export interface LambdaAuthorizerTokenRequest extends LambdaAuthorizerBaseRequest {
  authorizationToken: string;
}

export interface LambdaAuthorizerRequestRequest extends LambdaAuthorizerBaseRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
}

export interface LambdaAuthorizerRequest extends LambdaAuthorizerBaseRequest {
  authorizationToken?: string;
  method?: string;
  path?: string;
  headers?: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
}

export type LambdaAuthorizerFilterInput = Omit<LambdaAuthorizerRequest, 'context'>;

export type LambdaAuthorizerContext = Record<string, JsonValue>;

// aws-lambda splits this across two interfaces, and the context-free one absorbs any context, leaving
// its shape unchecked. API Gateway documents one shape with an optional context.
export interface LambdaAuthorizerSimpleResult<TContext extends LambdaAuthorizerContext = LambdaAuthorizerContext>
  extends APIGatewaySimpleAuthorizerResult {
  context?: TContext;
}

export type LambdaAuthorizerResult<TContext extends LambdaAuthorizerContext = LambdaAuthorizerContext> =
  | APIGatewayAuthorizerResult
  | LambdaAuthorizerSimpleResult<TContext>;

export type LambdaAuthorizerHandler<TContext extends LambdaAuthorizerContext = LambdaAuthorizerContext> = (
  request: LambdaAuthorizerRequest,
) => Promise<LambdaAuthorizerResult<TContext> | boolean>;

// Middleware is invariant in its result and also registers router-wide, where no route's context
// applies, so it stays on the widest result.
export type LambdaAuthorizerMiddleware = Middleware<LambdaAuthorizerRequest, LambdaAuthorizerResult | boolean>;

export interface LambdaAuthorizerRouteDefinition<TContext extends LambdaAuthorizerContext = LambdaAuthorizerContext> {
  filters: LambdaAuthorizerFilters;
  middleware?: LambdaAuthorizerMiddleware[];
  handler: LambdaAuthorizerHandler<TContext>;
}

export interface LambdaAuthorizerRouterOptions {
  middleware?: LambdaAuthorizerMiddleware[];
}
