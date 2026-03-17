import type {
  APIGatewayEventRequestContextV2,
  APIGatewayRequestAuthorizerEvent,
  APIGatewayRequestAuthorizerEventV2,
  APIGatewayTokenAuthorizerEvent,
  Context,
} from 'aws-lambda';
import { createMockContext } from './context.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type ApiGatewayLambdaAuthorizerTokenEventOverrides = Partial<APIGatewayTokenAuthorizerEvent>;

export function createApiGatewayLambdaAuthorizerTokenEvent(
  overrides: ApiGatewayLambdaAuthorizerTokenEventOverrides = {},
): APIGatewayTokenAuthorizerEvent {
  return {
    type: 'TOKEN',
    authorizationToken: 'Bearer test-token',
    methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abc123/prod/GET/resource',
    ...overrides,
  };
}

export interface ApiGatewayLambdaAuthorizerRequestV1EventOverrides
  extends Omit<Partial<APIGatewayRequestAuthorizerEvent>, 'requestContext'> {
  requestContext?: Partial<APIGatewayRequestAuthorizerEvent['requestContext']>;
}

export function createApiGatewayLambdaAuthorizerRequestV1Event(
  overrides: ApiGatewayLambdaAuthorizerRequestV1EventOverrides = {},
): APIGatewayRequestAuthorizerEvent {
  const { requestContext: requestContextOverrides, ...restOverrides } = overrides;

  return {
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
      ...requestContextOverrides,
    },
    ...restOverrides,
  };
}

export interface ApiGatewayLambdaAuthorizerRequestV2EventOverrides
  extends Omit<Partial<APIGatewayRequestAuthorizerEventV2>, 'requestContext'> {
  requestContext?: Partial<Omit<APIGatewayEventRequestContextV2, 'http'>> & {
    http?: Partial<APIGatewayEventRequestContextV2['http']>;
  };
}

export function createApiGatewayLambdaAuthorizerRequestV2Event(
  overrides: ApiGatewayLambdaAuthorizerRequestV2EventOverrides = {},
): APIGatewayRequestAuthorizerEventV2 {
  const { requestContext: requestContextOverrides, ...restOverrides } = overrides;
  const { http: httpOverrides, ...restRequestContextOverrides } = requestContextOverrides ?? {};

  return {
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
        ...httpOverrides,
      },
      requestId: crypto.randomUUID(),
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
      ...restRequestContextOverrides,
    },
    ...restOverrides,
  };
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
}

export const apiGatewayLambdaAuthorizerFixtures: FixtureMap<ApiGatewayLambdaAuthorizerFixtures> = {
  apiGatewayLambdaAuthorizerTokenEvent: fixture(createApiGatewayLambdaAuthorizerTokenEvent),
  apiGatewayLambdaAuthorizerTokenHandlerEvent: fixture(createApiGatewayLambdaAuthorizerTokenHandlerEvent),
  apiGatewayLambdaAuthorizerRequestV1Event: fixture(createApiGatewayLambdaAuthorizerRequestV1Event),
  apiGatewayLambdaAuthorizerRequestV1HandlerEvent: fixture(createApiGatewayLambdaAuthorizerRequestV1HandlerEvent),
  apiGatewayLambdaAuthorizerRequestV2Event: fixture(createApiGatewayLambdaAuthorizerRequestV2Event),
  apiGatewayLambdaAuthorizerRequestV2HandlerEvent: fixture(createApiGatewayLambdaAuthorizerRequestV2HandlerEvent),
};
