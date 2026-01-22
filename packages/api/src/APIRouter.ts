import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { type BodyRouteMethodFn, type NoBodyRouteMethodFn, PathRouter, type RouteMethodFn } from './PathRouter.js';
import { Request } from './Request.js';
import { Response } from './Response.js';
import type {
  AnyHttpMethod,
  ApiRequest,
  ApiResponse,
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

export class APIRouter implements EventTypeRouter<APIGatewayProxyEventV2, APIGatewayProxyResultV2> {
  private router = new PathRouter();
  private response = new Response();

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

  canHandleEvent(event: unknown): event is APIGatewayProxyEventV2 {
    if (!isObject(event)) return false;

    // Check for required V2 properties
    if (typeof event.rawPath !== 'string') return false;
    if (!isObject(event.requestContext)) return false;
    if (!isObject(event.requestContext.http)) return false;
    if (typeof event.requestContext.http.method !== 'string') return false;

    return true;
  }

  async handleEvent(event: APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResultV2> {
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    const routeData = this.router.match(method, path);
    if (!routeData) {
      return this.response.notFound();
    }

    const { route, params } = routeData;
    const request = new Request(event, context, route, params);

    try {
      request.validate();
      const requestData = request.buildApiRequest();
      const handlerResponse = await route.handler(requestData);
      return this.response.create(handlerResponse);
    } catch (error) {
      // This allows HTTPErrors and HTTPRedirects to be thrown to help code flow
      if (Response.isHTTPResponse(error)) {
        return this.response.create(error);
      }
      const errorMessage = error instanceof Error ? error.message : undefined;
      return this.response.internalServerError(errorMessage);
    }
  }
}

export function createApiRouter(): APIRouter {
  return new APIRouter();
}
