import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createMockContext } from './context.js';

export interface ApiGatewayV1HandlerEvent {
  event: APIGatewayProxyEvent;
  context: Context;
}

export type ApiGatewayV1EventOverrides = Omit<Partial<APIGatewayProxyEvent>, 'requestContext' | 'body'> & {
  requestContext?: Partial<APIGatewayProxyEvent['requestContext']>;
  body?: string | Record<string, unknown> | null;
};

export function createApiGatewayV1Event(overrides: ApiGatewayV1EventOverrides = {}): APIGatewayProxyEvent {
  const { requestContext: requestContextOverrides, body: bodyOverride, ...restOverrides } = overrides;

  const isObjectBody = bodyOverride !== null && typeof bodyOverride === 'object';
  const resolvedBody = isObjectBody ? JSON.stringify(bodyOverride) : (bodyOverride ?? null);

  return {
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
      ...requestContextOverrides,
    },
    ...restOverrides,
    ...(resolvedBody !== null ? { body: resolvedBody } : {}),
  };
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
