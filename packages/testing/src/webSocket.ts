import type {
  APIGatewayEventWebsocketRequestContextV2,
  APIGatewayProxyWebsocketEventV2WithRequestContext,
  Context,
} from 'aws-lambda';
import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

type WebSocketEventType = 'CONNECT' | 'MESSAGE' | 'DISCONNECT';

interface WebSocketEvent
  extends APIGatewayProxyWebsocketEventV2WithRequestContext<APIGatewayEventWebsocketRequestContextV2> {
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
}

export type WebSocketEventOverrides = Omit<DeepPartial<WebSocketEvent>, 'body'> & {
  body?: string | Record<string, unknown> | null;
};

export function createWebSocketEvent(overrides: WebSocketEventOverrides = {}): WebSocketEvent {
  const { body: bodyOverride, ...restOverrides } = overrides;
  const hasBodyOverride = Object.hasOwn(overrides, 'body');

  function resolveBody(): string | undefined {
    if (!hasBodyOverride) return undefined;
    if (bodyOverride === null) return JSON.stringify(bodyOverride);
    if (typeof bodyOverride === 'object') return JSON.stringify(bodyOverride);
    return bodyOverride;
  }

  const body = resolveBody();

  const defaults: WebSocketEvent = {
    requestContext: {
      routeKey: '$default',
      eventType: 'MESSAGE' as WebSocketEventType,
      extendedRequestId: crypto.randomUUID(),
      requestTime: '01/Jan/2024:00:00:00 +0000',
      messageId: crypto.randomUUID(),
      stage: 'production',
      connectedAt: 1704067200000,
      requestTimeEpoch: 1704067200000,
      requestId: crypto.randomUUID(),
      domainName: 'abc123.execute-api.us-east-1.amazonaws.com',
      connectionId: 'TEST-CONNECTION-ID',
      apiId: 'abc123',
      messageDirection: 'IN',
    },
    body: body ?? '{"action":"sendMessage","message":"hello"}',
    isBase64Encoded: false,
  };

  return deepMerge(defaults, restOverrides);
}

export interface WebSocketHandlerEvent {
  event: WebSocketEvent;
  context: Context;
}

export interface CreateWebSocketHandlerEventOptions {
  event?: WebSocketEventOverrides;
  context?: Partial<Context>;
}

export function createWebSocketHandlerEvent(options: CreateWebSocketHandlerEventOptions = {}): WebSocketHandlerEvent {
  const event = createWebSocketEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface WebSocketFixtures {
  webSocketEvent: (overrides?: WebSocketEventOverrides) => ReturnType<typeof createWebSocketEvent>;
  webSocketHandlerEvent: (options?: CreateWebSocketHandlerEventOptions) => WebSocketHandlerEvent;
}

export const webSocketFixtures: FixtureMap<WebSocketFixtures> = {
  webSocketEvent: fixture(createWebSocketEvent),
  webSocketHandlerEvent: fixture(createWebSocketHandlerEvent),
};
