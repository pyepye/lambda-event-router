import type {
  APIGatewayEventRequestContextWithAuthorizer,
  APIGatewayRequestAuthorizerEvent,
  APIGatewayRequestAuthorizerEventV2,
  APIGatewayTokenAuthorizerEvent,
  Context,
} from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type ApiGatewayLambdaAuthorizerTokenEventOverrides = DeepPartial<APIGatewayTokenAuthorizerEvent>;

export function createApiGatewayLambdaAuthorizerTokenEvent(
  overrides: ApiGatewayLambdaAuthorizerTokenEventOverrides = {},
): APIGatewayTokenAuthorizerEvent {
  const defaults: APIGatewayTokenAuthorizerEvent = {
    type: 'TOKEN',
    authorizationToken: 'Bearer test-token',
    methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abc123/prod/GET/resource',
  };

  return deepMerge(defaults, overrides);
}

export type ApiGatewayLambdaAuthorizerRequestV1EventOverrides = DeepPartial<APIGatewayRequestAuthorizerEvent>;

export function createApiGatewayLambdaAuthorizerRequestV1Event(
  overrides: ApiGatewayLambdaAuthorizerRequestV1EventOverrides = {},
): APIGatewayRequestAuthorizerEvent {
  const defaults: APIGatewayRequestAuthorizerEvent = {
    type: 'REQUEST',
    methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abc123/prod/GET/resource',
    resource: '/resource',
    path: '/',
    httpMethod: 'GET',
    headers: {},
    multiValueHeaders: {},
    pathParameters: null,
    queryStringParameters: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'abc123',
      authorizer: undefined,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/',
      stage: 'prod',
      requestId: crypto.randomUUID(),
      requestTimeEpoch: 1704067200000,
      resourceId: 'abc123',
      resourcePath: '/resource',
    },
  };

  return deepMerge(defaults, overrides);
}

// A repeated header or query param reaches this authorizer as its last value alone: API Gateway sends
// neither multi-value map on payload format 1.0.
export interface ApiGatewayLambdaAuthorizerRequestHttpApiV1Event {
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

export type ApiGatewayLambdaAuthorizerRequestHttpApiV1EventOverrides =
  DeepPartial<ApiGatewayLambdaAuthorizerRequestHttpApiV1Event>;

export function createApiGatewayLambdaAuthorizerRequestHttpApiV1Event(
  overrides: ApiGatewayLambdaAuthorizerRequestHttpApiV1EventOverrides = {},
): ApiGatewayLambdaAuthorizerRequestHttpApiV1Event {
  const defaults: ApiGatewayLambdaAuthorizerRequestHttpApiV1Event = {
    version: '1.0',
    type: 'REQUEST',
    methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abc123/$default/GET/resource',
    identitySource: 'Bearer test-token',
    authorizationToken: 'Bearer test-token',
    resource: '',
    path: '/',
    httpMethod: 'GET',
    headers: {},
    queryStringParameters: {},
    pathParameters: {},
    stageVariables: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'abc123',
      domainName: 'abc123.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'abc123',
      extendedRequestId: 'abc123=',
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/',
      stage: '$default',
      requestId: crypto.randomUUID(),
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: 1704067200000,
      resourceId: 'GET /resource',
      resourcePath: '/resource',
    },
  };

  return deepMerge(defaults, overrides);
}

export type ApiGatewayLambdaAuthorizerRequestV2EventOverrides = DeepPartial<APIGatewayRequestAuthorizerEventV2>;

export function createApiGatewayLambdaAuthorizerRequestV2Event(
  overrides: ApiGatewayLambdaAuthorizerRequestV2EventOverrides = {},
): APIGatewayRequestAuthorizerEventV2 {
  const defaults: APIGatewayRequestAuthorizerEventV2 = {
    version: '2.0',
    type: 'REQUEST',
    routeArn: 'arn:aws:execute-api:us-east-1:123456789012:abc123/$default/GET/resource',
    identitySource: ['Bearer test-token'],
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    cookies: [],
    headers: {},
    queryStringParameters: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'abc123',
      domainName: 'abc123.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'abc123',
      http: {
        method: 'GET',
        path: '/',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: crypto.randomUUID(),
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
  };

  return deepMerge(defaults, overrides);
}

export interface ApiGatewayLambdaAuthorizerTokenHandlerEvent {
  event: APIGatewayTokenAuthorizerEvent;
  context: Context;
}

export interface CreateApiGatewayLambdaAuthorizerTokenHandlerEventOptions {
  event?: ApiGatewayLambdaAuthorizerTokenEventOverrides;
  context?: Partial<Context>;
}

export function createApiGatewayLambdaAuthorizerTokenHandlerEvent(
  options: CreateApiGatewayLambdaAuthorizerTokenHandlerEventOptions = {},
): ApiGatewayLambdaAuthorizerTokenHandlerEvent {
  const event = createApiGatewayLambdaAuthorizerTokenEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface ApiGatewayLambdaAuthorizerRequestV1HandlerEvent {
  event: APIGatewayRequestAuthorizerEvent;
  context: Context;
}

export interface CreateApiGatewayLambdaAuthorizerRequestV1HandlerEventOptions {
  event?: ApiGatewayLambdaAuthorizerRequestV1EventOverrides;
  context?: Partial<Context>;
}

export function createApiGatewayLambdaAuthorizerRequestV1HandlerEvent(
  options: CreateApiGatewayLambdaAuthorizerRequestV1HandlerEventOptions = {},
): ApiGatewayLambdaAuthorizerRequestV1HandlerEvent {
  const event = createApiGatewayLambdaAuthorizerRequestV1Event(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface ApiGatewayLambdaAuthorizerRequestV2HandlerEvent {
  event: APIGatewayRequestAuthorizerEventV2;
  context: Context;
}

export interface CreateApiGatewayLambdaAuthorizerRequestV2HandlerEventOptions {
  event?: ApiGatewayLambdaAuthorizerRequestV2EventOverrides;
  context?: Partial<Context>;
}

export function createApiGatewayLambdaAuthorizerRequestV2HandlerEvent(
  options: CreateApiGatewayLambdaAuthorizerRequestV2HandlerEventOptions = {},
): ApiGatewayLambdaAuthorizerRequestV2HandlerEvent {
  const event = createApiGatewayLambdaAuthorizerRequestV2Event(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface ApiGatewayLambdaAuthorizerRequestHttpApiV1HandlerEvent {
  event: ApiGatewayLambdaAuthorizerRequestHttpApiV1Event;
  context: Context;
}

export interface CreateApiGatewayLambdaAuthorizerRequestHttpApiV1HandlerEventOptions {
  event?: ApiGatewayLambdaAuthorizerRequestHttpApiV1EventOverrides;
  context?: Partial<Context>;
}

export function createApiGatewayLambdaAuthorizerRequestHttpApiV1HandlerEvent(
  options: CreateApiGatewayLambdaAuthorizerRequestHttpApiV1HandlerEventOptions = {},
): ApiGatewayLambdaAuthorizerRequestHttpApiV1HandlerEvent {
  const event = createApiGatewayLambdaAuthorizerRequestHttpApiV1Event(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface ApiGatewayLambdaAuthorizerFixtures {
  apiGatewayLambdaAuthorizerTokenEvent: (
    overrides?: ApiGatewayLambdaAuthorizerTokenEventOverrides,
  ) => APIGatewayTokenAuthorizerEvent;
  apiGatewayLambdaAuthorizerTokenHandlerEvent: (
    options?: CreateApiGatewayLambdaAuthorizerTokenHandlerEventOptions,
  ) => ApiGatewayLambdaAuthorizerTokenHandlerEvent;
  apiGatewayLambdaAuthorizerRequestV1Event: (
    overrides?: ApiGatewayLambdaAuthorizerRequestV1EventOverrides,
  ) => APIGatewayRequestAuthorizerEvent;
  apiGatewayLambdaAuthorizerRequestV1HandlerEvent: (
    options?: CreateApiGatewayLambdaAuthorizerRequestV1HandlerEventOptions,
  ) => ApiGatewayLambdaAuthorizerRequestV1HandlerEvent;
  apiGatewayLambdaAuthorizerRequestV2Event: (
    overrides?: ApiGatewayLambdaAuthorizerRequestV2EventOverrides,
  ) => APIGatewayRequestAuthorizerEventV2;
  apiGatewayLambdaAuthorizerRequestV2HandlerEvent: (
    options?: CreateApiGatewayLambdaAuthorizerRequestV2HandlerEventOptions,
  ) => ApiGatewayLambdaAuthorizerRequestV2HandlerEvent;
  apiGatewayLambdaAuthorizerRequestHttpApiV1Event: (
    overrides?: ApiGatewayLambdaAuthorizerRequestHttpApiV1EventOverrides,
  ) => ApiGatewayLambdaAuthorizerRequestHttpApiV1Event;
  apiGatewayLambdaAuthorizerRequestHttpApiV1HandlerEvent: (
    options?: CreateApiGatewayLambdaAuthorizerRequestHttpApiV1HandlerEventOptions,
  ) => ApiGatewayLambdaAuthorizerRequestHttpApiV1HandlerEvent;
}

export const apiGatewayLambdaAuthorizerFixtures: FixtureMap<ApiGatewayLambdaAuthorizerFixtures> = {
  apiGatewayLambdaAuthorizerTokenEvent: fixture(createApiGatewayLambdaAuthorizerTokenEvent),
  apiGatewayLambdaAuthorizerTokenHandlerEvent: fixture(createApiGatewayLambdaAuthorizerTokenHandlerEvent),
  apiGatewayLambdaAuthorizerRequestV1Event: fixture(createApiGatewayLambdaAuthorizerRequestV1Event),
  apiGatewayLambdaAuthorizerRequestV1HandlerEvent: fixture(createApiGatewayLambdaAuthorizerRequestV1HandlerEvent),
  apiGatewayLambdaAuthorizerRequestV2Event: fixture(createApiGatewayLambdaAuthorizerRequestV2Event),
  apiGatewayLambdaAuthorizerRequestV2HandlerEvent: fixture(createApiGatewayLambdaAuthorizerRequestV2HandlerEvent),
  apiGatewayLambdaAuthorizerRequestHttpApiV1Event: fixture(createApiGatewayLambdaAuthorizerRequestHttpApiV1Event),
  apiGatewayLambdaAuthorizerRequestHttpApiV1HandlerEvent: fixture(
    createApiGatewayLambdaAuthorizerRequestHttpApiV1HandlerEvent,
  ),
};
