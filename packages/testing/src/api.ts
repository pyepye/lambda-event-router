import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { createMockContext } from './context.js';

export interface ApiHandlerEvent {
  event: APIGatewayProxyEventV2;
  context: Context;
}

export type ApiEventOverrides = Omit<Partial<APIGatewayProxyEventV2>, 'requestContext' | 'body'> & {
  requestContext?: Omit<Partial<APIGatewayProxyEventV2['requestContext']>, 'http'> & {
    http?: Partial<APIGatewayProxyEventV2['requestContext']['http']>;
  };
  body?: string | Record<string, unknown> | null;
};

export function createApiEvent(overrides: ApiEventOverrides = {}): APIGatewayProxyEventV2 {
  const { requestContext: requestContextOverrides, body: bodyOverride, ...restOverrides } = overrides;
  const { http: httpOverrides, ...restRequestContextOverrides } = requestContextOverrides ?? {};

  const isObjectBody = bodyOverride !== null && typeof bodyOverride === 'object';
  const resolvedBody = isObjectBody ? JSON.stringify(bodyOverride) : (bodyOverride ?? undefined);

  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    headers: {},
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'api-id.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'api-id',
      requestId: crypto.randomUUID(),
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
      http: {
        method: 'GET',
        path: '/',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
        ...httpOverrides,
      },
      ...restRequestContextOverrides,
    },
    ...restOverrides,
    ...(resolvedBody !== undefined ? { body: resolvedBody } : {}),
  };
}

export interface CreateApiHandlerEventOptions {
  event?: ApiEventOverrides;
  context?: Partial<Context>;
}

export function createApiHandlerEvent(options: CreateApiHandlerEventOptions = {}): ApiHandlerEvent {
  const event = createApiEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}
