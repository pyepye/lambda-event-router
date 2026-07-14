import type {
  APIGatewayEventWebsocketRequestContextV2,
  APIGatewayProxyWebsocketEventV2WithRequestContext,
  Context,
} from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { Middleware } from '@lambda-event-router/base';

export interface WebSocketEvent
  extends APIGatewayProxyWebsocketEventV2WithRequestContext<APIGatewayEventWebsocketRequestContextV2> {
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
}

export type WebSocketEventType = 'CONNECT' | 'MESSAGE' | 'DISCONNECT';

export interface WebSocketFilters {
  eventType?: WebSocketEventType;
  routeKey?: string;
  custom?: (input: WebSocketFilterInput) => boolean | Promise<boolean>;
}

export interface WebSocketFilterInput {
  eventType: WebSocketEventType;
  routeKey: string;
  body: unknown;
  event: WebSocketEvent;
}

export interface WebSocketBaseRequest {
  connectionId: string;
  domainName: string;
  stage: string;
  eventType: WebSocketEventType;
  routeKey: string;
  event: WebSocketEvent;
  context: Context;
}

// Each request pins its own eventType, so Extract<WebSocketRequest, { eventType }> narrows the union
// and a handler can discriminate on the field
export interface WebSocketConnectRequest extends WebSocketBaseRequest {
  eventType: 'CONNECT';
  queryStringParameters: Record<string, string> | undefined;
}

export interface WebSocketMessageRequest<TBody = unknown> extends WebSocketBaseRequest {
  eventType: 'MESSAGE';
  body: TBody;
}

export interface WebSocketDisconnectRequest extends WebSocketBaseRequest {
  eventType: 'DISCONNECT';
}

export type WebSocketRequest<TBody = unknown> =
  | WebSocketConnectRequest
  | WebSocketMessageRequest<TBody>
  | WebSocketDisconnectRequest;

// body and headers are never sent: the router hands Lambda a WebSocketResult, which is the status code
// alone. Typing them out is what stops an HTTP response helper being returned here
export type WebSocketConnectResponse = { statusCode: number; body?: never; headers?: never } | undefined;

export interface WebSocketResult {
  statusCode: number;
}

// A connect handler answers with a status code; message and disconnect handlers answer with nothing
export type WebSocketHandler<TBody = unknown> = (
  request: WebSocketRequest<TBody>,
) => Promise<WebSocketConnectResponse> | Promise<void>;

export type WebSocketMiddleware<TBody = unknown> = Middleware<WebSocketRequest<TBody>, WebSocketConnectResponse>;

export interface WebSocketConnectRouteDefinition {
  filters?: Omit<WebSocketFilters, 'eventType'>;
  middleware?: WebSocketMiddleware[];
  handler: (request: WebSocketConnectRequest) => Promise<WebSocketConnectResponse>;
}

export interface WebSocketMessageRouteDefinition<TBody = unknown> {
  filters?: Omit<WebSocketFilters, 'eventType'>;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  middleware?: WebSocketMiddleware<TBody>[];
  handler: (request: WebSocketMessageRequest<TBody>) => Promise<void>;
}

export interface WebSocketDisconnectRouteDefinition {
  filters?: Omit<WebSocketFilters, 'eventType'>;
  middleware?: WebSocketMiddleware[];
  handler: (request: WebSocketDisconnectRequest) => Promise<void>;
}

export interface WebSocketRouteDefinition<TBody = unknown> {
  filters: WebSocketFilters;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  middleware?: WebSocketMiddleware<TBody>[];
  handler: WebSocketHandler<TBody>;
}
