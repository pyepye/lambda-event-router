import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
  APIGatewayEventWebsocketRequestContextV2,
  APIGatewayProxyWebsocketEventV2WithRequestContext,
  Context,
} from 'aws-lambda';

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
  customFilter?: (input: WebSocketFilterInput) => boolean;
}

export interface WebSocketFilterInput {
  eventType: WebSocketEventType;
  routeKey: string;
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

export interface WebSocketConnectRequest extends WebSocketBaseRequest {
  queryStringParameters: Record<string, string> | undefined;
}

export interface WebSocketMessageRequest<TBody = unknown> extends WebSocketBaseRequest {
  body: TBody;
}

export type WebSocketDisconnectRequest = WebSocketBaseRequest;

export type WebSocketConnectResponse = { statusCode: number } | undefined;

export interface WebSocketResult {
  statusCode: number;
}

export interface WebSocketRequest<TBody = unknown, TQueryString = Record<string, string> | undefined>
  extends WebSocketBaseRequest {
  body: TBody;
  queryStringParameters: TQueryString;
}

export type WebSocketHandler<TBody = unknown> = (request: WebSocketRequest<TBody>) => Promise<WebSocketConnectResponse>;

export interface WebSocketRouteDefinition<TBody = unknown> {
  filters: WebSocketFilters;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  handler: WebSocketHandler<TBody>;
}
