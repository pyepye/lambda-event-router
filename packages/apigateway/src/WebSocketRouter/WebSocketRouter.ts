import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, logger, safeJsonParse, validateSchema } from '@lambda-event-router/base';

import { isWebSocketResponse } from './response.js';
import type {
  WebSocketConnectResponse,
  WebSocketEvent,
  WebSocketEventType,
  WebSocketFilterInput,
  WebSocketFilters,
  WebSocketHandler,
  WebSocketMiddleware,
  WebSocketRequest,
  WebSocketResult,
  WebSocketRouteDefinition,
} from './types.js';

interface InternalRoute {
  filters: WebSocketFilters;
  bodySchema?: StandardSchemaV1;
  middleware?: WebSocketMiddleware[];
  handler: WebSocketHandler;
}

export interface WebSocketRouterOptions {
  middleware?: WebSocketMiddleware[];
}

interface RouteInput<
  TEventType extends WebSocketEventType | undefined = undefined,
  TRouteKey extends string | undefined = undefined,
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
> {
  filters: {
    eventType?: TEventType;
    routeKey?: TRouteKey;
    custom?: (input: WebSocketFilterInput) => boolean | Promise<boolean>;
  };
  bodySchema?: TBodySchema;
  middleware?: WebSocketMiddleware<TBody>[];
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
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
  TQueryString = TEventType extends 'CONNECT' ? Record<string, string> | undefined : undefined,
>(config: RouteInput<TEventType, TRouteKey, TBodySchema>): RouteBuilder<TBody, TQueryString> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): WebSocketRouteDefinition<TBody> {
      return { ...config, handler } as WebSocketRouteDefinition<TBody>;
    },
  };
}

export interface WebSocketConnectInput {
  middleware?: WebSocketMiddleware[];
  handler: (request: WebSocketRequest) => Promise<WebSocketConnectResponse>;
}

export interface WebSocketDisconnectInput {
  middleware?: WebSocketMiddleware[];
  handler: (request: WebSocketRequest) => Promise<void>;
}

export interface WebSocketMessageInput<TBody = unknown> {
  routeKey?: string;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  middleware?: WebSocketMiddleware<TBody>[];
  handler: (request: WebSocketRequest<TBody>) => Promise<void>;
}

export class WebSocketRouter implements EventTypeRouter<WebSocketEvent, WebSocketResult> {
  private routes: InternalRoute[] = [];
  private middleware: WebSocketMiddleware[];

  constructor(options?: WebSocketRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

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
    TBodySchema extends StandardSchemaV1 | undefined = undefined,
    TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
    TQueryString = TEventType extends 'CONNECT' ? Record<string, string> | undefined : undefined,
  >(definition: {
    filters: { eventType?: TEventType; routeKey?: TRouteKey };
    bodySchema?: TBodySchema;
    middleware?: WebSocketMiddleware<TBody>[];
    handler: (request: WebSocketRequest<TBody, TQueryString>) => Promise<WebSocketConnectResponse>;
  }): this;

  route<
    TEventType extends WebSocketEventType | undefined = undefined,
    TRouteKey extends string | undefined = undefined,
    TBodySchema extends StandardSchemaV1 | undefined = undefined,
    TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
    TQueryString = TEventType extends 'CONNECT' ? Record<string, string> | undefined : undefined,
  >(definition: {
    filters: { eventType?: TEventType; routeKey?: TRouteKey };
    bodySchema?: TBodySchema;
    middleware?: WebSocketMiddleware<TBody>[];
    handler: (request: WebSocketRequest<TBody, TQueryString>) => Promise<void>;
  }): this;

  route(definition: {
    filters: { eventType?: WebSocketEventType; routeKey?: string };
    bodySchema?: StandardSchemaV1;
    middleware?: WebSocketMiddleware[];
    handler: (...args: never[]) => Promise<unknown>;
  }): this {
    this.routes.push({
      filters: definition.filters,
      bodySchema: definition.bodySchema,
      middleware: definition.middleware,
      handler: definition.handler as WebSocketHandler,
    });
    return this;
  }

  connect({ middleware, handler }: WebSocketConnectInput): this {
    this.routes.push({
      filters: { eventType: 'CONNECT' },
      middleware,
      handler: handler as WebSocketHandler,
    });
    return this;
  }

  disconnect({ middleware, handler }: WebSocketDisconnectInput): this {
    this.routes.push({
      filters: { eventType: 'DISCONNECT' },
      middleware,
      handler: handler as WebSocketHandler,
    });
    return this;
  }

  message<TBody>({ routeKey, bodySchema, middleware, handler }: WebSocketMessageInput<TBody>): this {
    this.routes.push({
      filters: { eventType: 'MESSAGE', routeKey },
      bodySchema,
      // @ts-expect-error Contravariance: body-typed route middleware is safe at runtime because the schema validates the body before the chain runs
      middleware,
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

    const route = await this.matchRoute(filterInput);
    if (!route) {
      throw new Error(`No route matched for WebSocket event (eventType: ${eventType}, routeKey: ${routeKey})`);
    }

    const parsedBody = safeJsonParse(event.body);
    const validatedBody = await validateSchema(
      parsedBody,
      route.bodySchema,
      'Body validation failed for WebSocket body',
    );

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

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];

    try {
      const response = await handleEventWithMiddleware(allMiddleware, request, route.handler);
      return this.buildResult(response);
    } catch (error) {
      if (isWebSocketResponse(error)) {
        return { statusCode: error.statusCode };
      }
      throw error;
    }
  }

  private async matchRoute(filterInput: WebSocketFilterInput): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.eventType && filters.eventType !== filterInput.eventType) {
        continue;
      }

      if (filters.routeKey && filters.routeKey !== filterInput.routeKey) {
        continue;
      }

      if (filters.custom) {
        const match = await filters.custom(filterInput);
        if (!match) continue;
      }
      return route;
    }
    return undefined;
  }

  private buildResult(response: WebSocketConnectResponse): WebSocketResult {
    if (!response) {
      return { statusCode: 200 };
    }

    if (isObject(response) && typeof response.statusCode === 'number') {
      return { statusCode: response.statusCode };
    }

    logger.warn('WebSocket handler returned an unexpected value; defaulting to statusCode 200', { response });
    return { statusCode: 200 };
  }
}

export function createWebSocketRouter(options?: WebSocketRouterOptions): WebSocketRouter {
  return new WebSocketRouter(options);
}
