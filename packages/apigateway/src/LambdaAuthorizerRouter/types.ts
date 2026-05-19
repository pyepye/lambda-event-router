import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
  Context,
} from 'aws-lambda';

export type LambdaAuthorizerEvent =
  | APIGatewayTokenAuthorizerEvent
  | APIGatewayRequestAuthorizerEvent
  | APIGatewayRequestAuthorizerEventV2;

export type AuthorizerType = 'TOKEN' | 'REQUEST';

export interface LambdaAuthorizerFilters {
  type?: AuthorizerType;
  method?: string;
  custom?: (input: LambdaAuthorizerFilterInput) => boolean | Promise<boolean>;
}

export interface LambdaAuthorizerFilterInput {
  type: AuthorizerType;
  method?: string;
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

export type LambdaAuthorizerResult = APIGatewayAuthorizerResult | APIGatewaySimpleAuthorizerResult;

export type LambdaAuthorizerHandler = (request: LambdaAuthorizerRequest) => Promise<LambdaAuthorizerResult | boolean>;

export interface LambdaAuthorizerRouteDefinition {
  filters: LambdaAuthorizerFilters;
  handler: LambdaAuthorizerHandler;
}
