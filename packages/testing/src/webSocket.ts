import type {
  APIGatewayEventWebsocketRequestContextV2,
  APIGatewayProxyWebsocketEventV2WithRequestContext,
  Context,
} from 'aws-lambda';
import { createMockContext } from './context.js';

type WebSocketEventType = 'CONNECT' | 'MESSAGE' | 'DISCONNECT';

interface WebSocketEvent
  extends APIGatewayProxyWebsocketEventV2WithRequestContext<APIGatewayEventWebsocketRequestContextV2> {
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
}

export interface WebSocketEventOverrides {
  requestContext?: Partial<WebSocketEvent['requestContext']>;
  body?: string;
  isBase64Encoded?: boolean;
  stageVariables?: Record<string, string>;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
}

export function createWebSocketEvent(overrides: WebSocketEventOverrides = {}): WebSocketEvent {
  const { requestContext: requestContextOverrides, ...restOverrides } = overrides;

  return {
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
      ...requestContextOverrides,
    },
    body: '{"action":"sendMessage","message":"hello"}',
    isBase64Encoded: false,
    ...restOverrides,
  };
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
