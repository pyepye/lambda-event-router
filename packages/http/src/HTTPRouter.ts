import type { EventTypeRouter } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import { type BodyRouteMethodFn, type NoBodyRouteMethodFn, PathRouter, type RouteMethodFn } from './PathRouter.js';
import { Request } from './Request.js';
import { Response } from './Response.js';
import type {
  AnyHttpMethod,
  ApiRequest,
  ApiResponse,
  HTTPAdapter,
  InferSchema,
  PathParams,
  RouteDefinition,
  Schema,
} from './types.js';

// Compute response type from schema - if no schema provided, body must be undefined or null
type ResponseType<TResponseSchema> = TResponseSchema extends Schema<infer R> ? R : undefined | null;

// Config without handler (for builder pattern)
interface RouteInput<
  TPathString extends string,
  TPathSchema extends Schema<unknown> | undefined,
  TQuerySchema extends Schema<unknown> | undefined,
  TBodySchema extends Schema<unknown> | undefined,
  TResponseSchema extends Schema<unknown> | undefined,
> {
  method: AnyHttpMethod;
  path: TPathString;
  pathSchema?: TPathSchema;
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
  TPathSchema extends Schema<unknown> | undefined = undefined,
  TQuerySchema extends Schema<unknown> | undefined = undefined,
  TBodySchema extends Schema<unknown> | undefined = undefined,
  TResponseSchema extends Schema<unknown> | undefined = undefined,
  TPath = TPathSchema extends Schema<unknown> ? InferSchema<TPathSchema> : PathParams<TPathString>,
  TQuery = TQuerySchema extends Schema<unknown> ? InferSchema<TQuerySchema> : Record<string, string | undefined>,
  TBody = TBodySchema extends Schema<unknown> ? InferSchema<TBodySchema> : unknown,
  TResponse = ResponseType<TResponseSchema>,
>(
  config: RouteInput<TPathString, TPathSchema, TQuerySchema, TBodySchema, TResponseSchema>,
): RouteBuilder<TPathString, TPath, TQuery, TBody, TResponse> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): RouteDefinition<TPathString, TPath, TQuery, TBody, TResponse> {
      return { ...config, handler } as RouteDefinition<TPathString, TPath, TQuery, TBody, TResponse>;
    },
  };
}

export class HTTPRouter<TEvent, TResult> implements EventTypeRouter<TEvent, TResult> {
  private router = new PathRouter();
  private response = new Response();

  constructor(private adapter: HTTPAdapter<TEvent, TResult>) {}

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
      request.validate();
      const requestData = request.buildApiRequest();
      const handlerResponse = await route.handler(requestData);
      const finalizedResponse = this.response.create(handlerResponse);
      return this.adapter.buildResult(finalizedResponse, event);
    } catch (error) {
      if (Response.isHTTPResponse(error)) {
        const finalizedResponse = this.response.create(error);
        return this.adapter.buildResult(finalizedResponse, event);
      }
      const errorMessage = error instanceof Error ? error.message : undefined;
      const errorResponse = this.response.internalServerError(errorMessage);
      return this.adapter.buildResult(errorResponse, event);
    }
  }
}
