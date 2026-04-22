import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface ApiGatewayV1HandlerEvent {
  event: APIGatewayProxyEvent;
  context: Context;
}

export type ApiGatewayV1EventOverrides = Omit<DeepPartial<APIGatewayProxyEvent>, 'body'> & {
  body?: string | Record<string, unknown> | null;
};

export function createApiGatewayV1Event(overrides: ApiGatewayV1EventOverrides = {}): APIGatewayProxyEvent {
  const { body: bodyOverride, ...restOverrides } = overrides;
  const hasBodyOverride = Object.hasOwn(overrides, 'body');

  let resolvedBody: string | null = null;
  if (hasBodyOverride) {
    if (bodyOverride !== null && bodyOverride !== undefined && typeof bodyOverride === 'object') {
      resolvedBody = JSON.stringify(bodyOverride);
    } else if (typeof bodyOverride === 'string') {
      resolvedBody = bodyOverride;
    }
  }

  const defaults: APIGatewayProxyEvent = {
    httpMethod: 'GET',
    path: '/',
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    body: resolvedBody,
    isBase64Encoded: false,
    resource: '/{proxy+}',
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: null,
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
      requestTimeEpoch: 1704067200000,
      resourceId: 'resource-id',
      resourcePath: '/{proxy+}',
    },
  };

  return deepMerge(defaults, restOverrides);
}

export interface CreateApiGatewayV1HandlerEventOptions {
  event?: ApiGatewayV1EventOverrides;
  context?: Partial<Context>;
}

export function createApiGatewayV1HandlerEvent(
  options: CreateApiGatewayV1HandlerEventOptions = {},
): ApiGatewayV1HandlerEvent {
  const event = createApiGatewayV1Event(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface ApiGatewayV1Fixtures {
  apiGatewayV1Event: (overrides?: ApiGatewayV1EventOverrides) => APIGatewayProxyEvent;
  apiGatewayV1HandlerEvent: (options?: CreateApiGatewayV1HandlerEventOptions) => ApiGatewayV1HandlerEvent;
}

export const apiGatewayV1Fixtures: FixtureMap<ApiGatewayV1Fixtures> = {
  apiGatewayV1Event: fixture(createApiGatewayV1Event),
  apiGatewayV1HandlerEvent: fixture(createApiGatewayV1HandlerEvent),
};
