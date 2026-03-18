import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface ApiGatewayV2HandlerEvent {
  event: APIGatewayProxyEventV2;
  context: Context;
}

export type ApiGatewayV2EventOverrides = Omit<DeepPartial<APIGatewayProxyEventV2>, 'body'> & {
  body?: string | Record<string, unknown> | null;
};

export function createApiGatewayV2Event(overrides: ApiGatewayV2EventOverrides = {}): APIGatewayProxyEventV2 {
  const { body: bodyOverride, ...restOverrides } = overrides;
  const hasBodyOverride = Object.hasOwn(overrides, 'body');

  let resolvedBody: string | undefined;
  if (hasBodyOverride) {
    if (bodyOverride !== null && bodyOverride !== undefined && typeof bodyOverride === 'object') {
      resolvedBody = JSON.stringify(bodyOverride);
    } else if (typeof bodyOverride === 'string') {
      resolvedBody = bodyOverride;
    }
  }

  const defaults: APIGatewayProxyEventV2 = {
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
      },
    },
    ...(resolvedBody !== undefined ? { body: resolvedBody } : {}),
  };

  return deepMerge(defaults, restOverrides);
}

export interface CreateApiGatewayV2HandlerEventOptions {
  event?: ApiGatewayV2EventOverrides;
  context?: Partial<Context>;
}

export function createApiGatewayV2HandlerEvent(
  options: CreateApiGatewayV2HandlerEventOptions = {},
): ApiGatewayV2HandlerEvent {
  const event = createApiGatewayV2Event(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface ApiGatewayV2Fixtures {
  apiGatewayV2Event: (overrides?: ApiGatewayV2EventOverrides) => APIGatewayProxyEventV2;
  apiGatewayV2HandlerEvent: (options?: CreateApiGatewayV2HandlerEventOptions) => ApiGatewayV2HandlerEvent;
}

export const apiGatewayV2Fixtures: FixtureMap<ApiGatewayV2Fixtures> = {
  apiGatewayV2Event: fixture(createApiGatewayV2Event),
  apiGatewayV2HandlerEvent: fixture(createApiGatewayV2HandlerEvent),
};
