import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, logger, safeJsonParse, validateSchema } from '@lambda-event-router/base';

import { isHTTPShapedResponse, isWebSocketResponse } from './response.js';
import type {
  WebSocketConnectResponse,
  WebSocketConnectRouteDefinition,
  WebSocketDisconnectRouteDefinition,
  WebSocketEvent,
  WebSocketEventType,
  WebSocketFilterInput,
  WebSocketFilters,
  WebSocketMessageRouteDefinition,
  WebSocketMiddleware,
  WebSocketRequest,
  WebSocketResult,
  WebSocketRouteDefinition,
} from './types.js';

interface InternalRoute {
  filters: WebSocketFilters;
  bodySchema?: StandardSchemaV1;
  middleware?: WebSocketMiddleware[];
  handler: (request: WebSocketRequest) => Promise<WebSocketConnectResponse>;
}

export interface WebSocketRouterOptions {
  middleware?: WebSocketMiddleware[];
}

type FiltersToRequest<TEventType extends WebSocketEventType | undefined, TBody> = TEventType extends WebSocketEventType
  ? Extract<WebSocketRequest<TBody>, { eventType: TEventType }>
  : WebSocketRequest<TBody>;

// eventType picks the request branch and routeKey the literal type, so both are re-declared
// generically over the WebSocketFilters base
type WebSocketRouteInputFilters<
  TEventType extends WebSocketEventType | undefined,
  TRouteKey extends string | undefined,
> = Omit<WebSocketFilters, 'eventType' | 'routeKey'> & {
  eventType?: TEventType;
  routeKey?: TRouteKey;
};

interface RouteInput<
  TEventType extends WebSocketEventType | undefined = undefined,
  TRouteKey extends string | undefined = undefined,
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
> {
  filters: WebSocketRouteInputFilters<TEventType, TRouteKey>;
  bodySchema?: TBodySchema;
  middleware?: WebSocketMiddleware<TBody>[];
}

interface RouteBuilder<TRequest, TBody> {
  handle(
    handler: (request: TRequest) => Promise<WebSocketConnectResponse> | Promise<void>,
  ): WebSocketRouteDefinition<TBody>;
}

export function defineWebSocketRoute<
  TEventType extends WebSocketEventType | undefined = undefined,
  TRouteKey extends string | undefined = undefined,
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
>(config: RouteInput<TEventType, TRouteKey, TBodySchema>): RouteBuilder<FiltersToRequest<TEventType, TBody>, TBody> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): WebSocketRouteDefinition<TBody> {
      return { ...config, handler } as unknown as WebSocketRouteDefinition<TBody>;
    },
  };
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
  >(definition: {
    filters: WebSocketRouteInputFilters<TEventType, TRouteKey>;
    bodySchema?: TBodySchema;
    middleware?: WebSocketMiddleware<TBody>[];
    handler: (request: FiltersToRequest<TEventType, TBody>) => Promise<WebSocketConnectResponse> | Promise<void>;
  }): this {
    this.routes.push({
      filters: definition.filters,
      bodySchema: definition.bodySchema,
      middleware: definition.middleware as WebSocketMiddleware[] | undefined,
      handler: definition.handler as InternalRoute['handler'],
    });
    return this;
  }

  connect({ filters, middleware, handler }: WebSocketConnectRouteDefinition): this {
    this.routes.push({
      filters: { ...filters, eventType: 'CONNECT' },
      middleware,
      handler: handler as InternalRoute['handler'],
    });
    return this;
  }

  disconnect({ filters, middleware, handler }: WebSocketDisconnectRouteDefinition): this {
    this.routes.push({
      filters: { ...filters, eventType: 'DISCONNECT' },
      middleware,
      handler: handler as InternalRoute['handler'],
    });
    return this;
  }

  message<TBody>({ filters, bodySchema, middleware, handler }: WebSocketMessageRouteDefinition<TBody>): this {
    this.routes.push({
      filters: { ...filters, eventType: 'MESSAGE' },
      bodySchema,
      // @ts-expect-error Contravariance: body-typed route middleware is safe at runtime because the schema validates the body before the chain runs
      middleware,
      handler: handler as InternalRoute['handler'],
    });
    return this;
  }

  async handleEvent(event: WebSocketEvent, context: Context): Promise<WebSocketResult> {
    const { connectionId, eventType, routeKey, domainName, stage } = event.requestContext;

    const parsedBody = safeJsonParse(event.body);

    const filterInput: WebSocketFilterInput = {
      eventType,
      routeKey,
      body: parsedBody,
      event,
    };

    const route = await this.matchRoute(filterInput);
    if (!route) {
      throw new Error(`No route matched for WebSocket event (eventType: ${eventType}, routeKey: ${routeKey})`);
    }

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
        if (isHTTPShapedResponse(error)) {
          logger.warn(
            'An HTTP response was thrown from a WebSocket handler. Its body and headers are dropped, since a WebSocket answer is a status code alone. Use the WebSocket helpers, for example WebSocketUnauthorised()',
            { statusCode: error.statusCode },
          );
        }
        return { statusCode: error.statusCode };
      }
      throw error;
    }
  }

  private async matchRoute(filterInput: WebSocketFilterInput): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.eventType !== undefined && filters.eventType !== filterInput.eventType) {
        continue;
      }

      if (filters.routeKey !== undefined && filters.routeKey !== filterInput.routeKey) {
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
