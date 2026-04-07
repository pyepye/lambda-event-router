import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import { handleEventWithMiddleware } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from 'aws-lambda';
import { type BodyRouteMethodFn, type NoBodyRouteMethodFn, PathRouter, type RouteMethodFn } from './PathRouter.js';
import { Request } from './Request.js';
import { Response } from './Response.js';
import type { AnyHttpMethod, ApiRequest, ApiResponse, HTTPAdapter, PathParams, RouteDefinition } from './types.js';

// Compute response type from schema - if no schema provided, body is untyped (unknown)
type ResponseType<TResponseSchema> = TResponseSchema extends StandardSchemaV1<unknown, infer R> ? R : unknown;

// Config without handler (for builder pattern)
interface RouteInput<
  TPathString extends string,
  TQuerySchema extends StandardSchemaV1 | undefined,
  TBodySchema extends StandardSchemaV1 | undefined,
  TResponseSchema extends StandardSchemaV1 | undefined,
  TPath = PathParams<TPathString>,
  TQuery = TQuerySchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TQuerySchema>
    : Record<string, string | undefined>,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
  TResponse = TResponseSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TResponseSchema> : unknown,
> {
  method: AnyHttpMethod;
  path: TPathString;
  middleware?: Middleware<ApiRequest<TPath, TQuery, TBody>, ApiResponse<TResponse>>[];
  querySchema?: TQuerySchema;
  bodySchema?: TBodySchema;
  responseSchema?: TResponseSchema;
}

// Builder that provides typed handle method
interface RouteBuilder<TPathString extends string, TPath, TQuery, TBody, TResponse> {
  handle(
    handler: (request: ApiRequest<TPath, TQuery, TBody>) => Promise<ApiResponse<TResponse>>,
  ): RouteDefinition<TPathString, TPath, TQuery, TBody, TResponse>;
}

export function defineRoute<
  TPathString extends string,
  TQuerySchema extends StandardSchemaV1 | undefined = undefined,
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TResponseSchema extends StandardSchemaV1 | undefined = undefined,
  TPath = PathParams<TPathString>,
  TQuery = TQuerySchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TQuerySchema>
    : Record<string, string | undefined>,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
  TResponse = ResponseType<TResponseSchema>,
>(
  config: RouteInput<TPathString, TQuerySchema, TBodySchema, TResponseSchema>,
): RouteBuilder<TPathString, TPath, TQuery, TBody, TResponse> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): RouteDefinition<TPathString, TPath, TQuery, TBody, TResponse> {
      return { ...config, handler } as RouteDefinition<TPathString, TPath, TQuery, TBody, TResponse>;
    },
  };
}

interface HTTPRouterOptions<TEvent, TResult> {
  adapter: HTTPAdapter<TEvent, TResult>;
  middleware?: Middleware<ApiRequest, ApiResponse>[];
}

export class HTTPRouter<TEvent, TResult> implements EventTypeRouter<TEvent, TResult> {
  private router = new PathRouter();
  private response = new Response();
  private middleware: Middleware<ApiRequest, ApiResponse>[];
  private adapter: HTTPAdapter<TEvent, TResult>;

  constructor(options: HTTPAdapter<TEvent, TResult> | HTTPRouterOptions<TEvent, TResult>) {
    if ('canHandleEvent' in options) {
      this.adapter = options;
      this.middleware = [];
    } else {
      this.adapter = options.adapter;
      this.middleware = options.middleware ?? [];
    }
  }

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from RouteMethodFn<this>
  route: RouteMethodFn<this> = (definition) => {
    this.router.route(definition);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  get: NoBodyRouteMethodFn<this> = (config) => {
    this.router.get(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from BodyRouteMethodFn<this>
  post: BodyRouteMethodFn<this> = (config) => {
    this.router.post(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from BodyRouteMethodFn<this>
  put: BodyRouteMethodFn<this> = (config) => {
    this.router.put(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from BodyRouteMethodFn<this>
  patch: BodyRouteMethodFn<this> = (config) => {
    this.router.patch(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  delete: NoBodyRouteMethodFn<this> = (config) => {
    this.router.delete(config);
    return this;
  };

  canHandleEvent(event: unknown): event is TEvent {
    return this.adapter.canHandleEvent(event);
  }

  async handleEvent(event: TEvent, context: Context): Promise<TResult> {
    const normalizedEvent = this.adapter.normalize(event);
    const { method, path } = normalizedEvent;

    const routeData = this.router.match(method, path);
    if (!routeData) {
      const notFoundResponse = this.response.notFound();
      return this.adapter.buildResult(notFoundResponse, event);
    }

    const { route, params } = routeData;
    const request = new Request(normalizedEvent, event, context, route, params);

    try {
      await request.validate();
      const requestData = request.buildApiRequest();

      const allMiddleware = [...this.middleware, ...route.middleware];
      const handlerResponse = await handleEventWithMiddleware(allMiddleware, requestData, route.handler);

      const response = this.response.create(handlerResponse);
      return this.adapter.buildResult(response, event);
    } catch (error) {
      if (Response.isHTTPResponse(error)) {
        const response = this.response.create(error);
        return this.adapter.buildResult(response, event);
      }
      const errorMessage = error instanceof Error ? error.message : undefined;
      const errorResponse = this.response.internalServerError(errorMessage);
      return this.adapter.buildResult(errorResponse, event);
    }
  }
}
