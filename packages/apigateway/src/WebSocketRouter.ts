import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import { isWebSocketResponse } from './webSocketResponse.js';
import type {
  WebSocketConnectResponse,
  WebSocketEvent,
  WebSocketEventType,
  WebSocketFilterInput,
  WebSocketFilters,
  WebSocketHandler,
  WebSocketRequest,
  WebSocketResult,
  WebSocketRouteDefinition,
} from './webSocketTypes.js';

interface InternalRoute {
  filters: WebSocketFilters;
  bodySchema?: Schema<unknown>;
  handler: WebSocketHandler;
}

interface RouteInput<
  TEventType extends WebSocketEventType | undefined = undefined,
  TRouteKey extends string | undefined = undefined,
  TBodySchema extends Schema<unknown> | undefined = undefined,
> {
  filters: { eventType?: TEventType; routeKey?: TRouteKey };
  bodySchema?: TBodySchema;
}

interface RouteBuilder<TBody, TQueryString> {
  handle(
    handler: (request: WebSocketRequest<TBody, TQueryString>) => Promise<WebSocketConnectResponse>,
  ): WebSocketRouteDefinition<TBody>;
  handle(handler: (request: WebSocketRequest<TBody, TQueryString>) => Promise<void>): WebSocketRouteDefinition<TBody>;
}

export function defineWebSocketRoute<
  TEventType extends WebSocketEventType | undefined = undefined,
  TRouteKey extends string | undefined = undefined,
  TBodySchema extends Schema<unknown> | undefined = undefined,
  TBody = TBodySchema extends Schema<unknown> ? InferSchema<TBodySchema> : unknown,
  TQueryString = TEventType extends 'CONNECT' ? Record<string, string> | undefined : undefined,
>(config: RouteInput<TEventType, TRouteKey, TBodySchema>): RouteBuilder<TBody, TQueryString> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): WebSocketRouteDefinition<TBody> {
      return { ...config, handler } as WebSocketRouteDefinition<TBody>;
    },
  };
}

interface ConnectInput {
  handler: (request: WebSocketRequest) => Promise<WebSocketConnectResponse>;
}

interface DisconnectInput {
  handler: (request: WebSocketRequest) => Promise<void>;
}

interface MessageInput<TBody = unknown> {
  routeKey?: string;
  bodySchema?: Schema<TBody>;
  handler: (request: WebSocketRequest<TBody>) => Promise<void>;
}

export class WebSocketRouter implements EventTypeRouter<WebSocketEvent, WebSocketResult> {
  private routes: InternalRoute[] = [];

  canHandleEvent(event: unknown): event is WebSocketEvent {
    if (!isObject(event)) return false;
    if (Object.hasOwn(event, 'rawPath')) return false;

    const requestContext = event.requestContext;
    if (!isObject(requestContext)) return false;

    return (
      typeof requestContext.connectionId === 'string' &&
      typeof requestContext.eventType === 'string' &&
      typeof requestContext.routeKey === 'string'
    );
  }

  route<
    TEventType extends WebSocketEventType | undefined = undefined,
    TRouteKey extends string | undefined = undefined,
    TBodySchema extends Schema<unknown> | undefined = undefined,
    TBody = TBodySchema extends Schema<unknown> ? InferSchema<TBodySchema> : unknown,
    TQueryString = TEventType extends 'CONNECT' ? Record<string, string> | undefined : undefined,
  >(definition: {
    filters: { eventType?: TEventType; routeKey?: TRouteKey };
    bodySchema?: TBodySchema;
    handler: (request: WebSocketRequest<TBody, TQueryString>) => Promise<WebSocketConnectResponse>;
  }): this;

  route<
    TEventType extends WebSocketEventType | undefined = undefined,
    TRouteKey extends string | undefined = undefined,
    TBodySchema extends Schema<unknown> | undefined = undefined,
    TBody = TBodySchema extends Schema<unknown> ? InferSchema<TBodySchema> : unknown,
    TQueryString = TEventType extends 'CONNECT' ? Record<string, string> | undefined : undefined,
  >(definition: {
    filters: { eventType?: TEventType; routeKey?: TRouteKey };
    bodySchema?: TBodySchema;
    handler: (request: WebSocketRequest<TBody, TQueryString>) => Promise<void>;
  }): this;

  route(definition: {
    filters: { eventType?: WebSocketEventType; routeKey?: string };
    bodySchema?: Schema<unknown>;
    handler: (...args: never[]) => Promise<unknown>;
  }): this {
    this.routes.push({
      filters: definition.filters,
      bodySchema: definition.bodySchema,
      handler: definition.handler as WebSocketHandler,
    });
    return this;
  }

  connect({ handler }: ConnectInput): this {
    this.routes.push({
      filters: { eventType: 'CONNECT' },
      handler: handler as WebSocketHandler,
    });
    return this;
  }

  disconnect({ handler }: DisconnectInput): this {
    this.routes.push({
      filters: { eventType: 'DISCONNECT' },
      handler: handler as WebSocketHandler,
    });
    return this;
  }

  message<TBody>({ routeKey, bodySchema, handler }: MessageInput<TBody>): this {
    this.routes.push({
      filters: { eventType: 'MESSAGE', routeKey },
      bodySchema,
      handler: handler as WebSocketHandler,
    });
    return this;
  }

  async handleEvent(event: WebSocketEvent, context: Context): Promise<WebSocketResult> {
    const { connectionId, eventType, routeKey, domainName, stage } = event.requestContext;

    const filterInput: WebSocketFilterInput = {
      eventType,
      routeKey,
    };

    const route = this.matchRoute(filterInput);
    if (!route) {
      throw new Error(`No route matched for WebSocket event (eventType: ${eventType}, routeKey: ${routeKey})`);
    }

    const parsedBody = this.parseBody(event.body);
    const validatedBody = this.validateBody(parsedBody, route.bodySchema);

    const request: WebSocketRequest = {
      connectionId,
      domainName,
      stage,
      eventType,
      routeKey,
      body: validatedBody,
      queryStringParameters: event.queryStringParameters,
      event,
      context,
    };

    try {
      const response = await route.handler(request);
      return this.buildResult(response);
    } catch (error) {
      if (isWebSocketResponse(error)) {
        return { statusCode: error.statusCode };
      }
      throw error;
    }
  }

  private matchRoute(filterInput: WebSocketFilterInput): InternalRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.eventType && filters.eventType !== filterInput.eventType) {
        return false;
      }

      if (filters.routeKey && filters.routeKey !== filterInput.routeKey) {
        return false;
      }

      return true;
    });
  }

  private parseBody(body: string | undefined): unknown {
    if (!body) return undefined;

    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  private validateBody(body: unknown, schema: Schema<unknown> | undefined): unknown {
    if (!schema) return body;

    const result = schema.safeParse(body);
    if (!result.success) {
      throw new Error('Body validation failed for WebSocket body', { cause: result.error });
    }
    return result.data;
  }

  private buildResult(response: WebSocketConnectResponse): WebSocketResult {
    if (!response) {
      return { statusCode: 200 };
    }

    if (isObject(response) && typeof response.statusCode === 'number') {
      return { statusCode: response.statusCode };
    }

    // TODO: Should log warn here
    return { statusCode: 200 };
  }
}

export function createWebSocketRouter(): WebSocketRouter {
  return new WebSocketRouter();
}
