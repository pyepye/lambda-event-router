import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import { handleEventWithMiddleware, logger } from '@lambda-event-router/base';

import { buildCorsHeaders, type CorsConfig } from './cors.js';
import { type BodyRouteMethodFn, type NoBodyRouteMethodFn, PathRouter, type RouteMethodFn } from './PathRouter.js';
import { Request } from './Request.js';
import { Response } from './Response.js';
import type {
  AnyHttpMethod,
  ApiRequest,
  FinalizedHTTPResponse,
  HandlerResponse,
  HTTPAdapter,
  HTTPFilterInput,
  HttpMethod,
  NormalizedHTTPEvent,
  PathParams,
  RouteDefinition,
} from './types.js';

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
  filters: {
    method: AnyHttpMethod;
    path: TPathString;
    customFilter?: (input: HTTPFilterInput) => boolean | Promise<boolean>;
  };
  middleware?: Middleware<ApiRequest<TPath, TQuery, TBody>, HandlerResponse<TResponse>>[];
  querySchema?: TQuerySchema;
  bodySchema?: TBodySchema;
  responseSchema?: TResponseSchema;
}

// Builder that provides typed handle method
interface RouteBuilder<TPathString extends string, TPath, TQuery, TBody, TResponse> {
  handle(
    handler: (request: ApiRequest<TPath, TQuery, TBody>) => Promise<HandlerResponse<TResponse>>,
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
  middleware?: Middleware<ApiRequest, HandlerResponse>[];
  cors?: CorsConfig;
}

export class HTTPRouter<TEvent, TResult> implements EventTypeRouter<TEvent, TResult> {
  private router = new PathRouter();
  private response = new Response();
  private middleware: Middleware<ApiRequest, HandlerResponse>[];
  private adapter: HTTPAdapter<TEvent, TResult>;
  private corsConfig: CorsConfig | undefined;

  constructor(options: HTTPAdapter<TEvent, TResult> | HTTPRouterOptions<TEvent, TResult>) {
    if ('canHandleEvent' in options) {
      this.adapter = options;
      this.middleware = [];
    } else {
      if (options.cors?.credentials && options.cors.origin === '*') {
        throw new Error('CORS configuration error: credentials cannot be used with wildcard (*) origin');
      }
      this.adapter = options.adapter;
      this.middleware = options.middleware ?? [];
      this.corsConfig = options.cors;
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

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  head: NoBodyRouteMethodFn<this> = (config) => {
    this.router.head(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  options: NoBodyRouteMethodFn<this> = (config) => {
    this.router.options(config);
    return this;
  };

  canHandleEvent(event: unknown): event is TEvent {
    return this.adapter.canHandleEvent(event);
  }

  private async getCorsHeaders(
    normalizedEvent: { headers: Record<string, string | undefined>; path: string },
    isPreflight: boolean,
    methods: HttpMethod[] = [],
  ): Promise<Record<string, string> | undefined> {
    if (!this.corsConfig) {
      return undefined;
    }

    const corsHeaders = await buildCorsHeaders({
      config: this.corsConfig,
      requestOrigin: normalizedEvent.headers.origin,
      path: normalizedEvent.path,
      isPreflight,
      requestHeaders: normalizedEvent.headers,
      methods,
    });

    if (corsHeaders) {
      return corsHeaders;
    }

    // For dynamic origins (array or function), always include Vary: Origin on non-preflight
    // responses so shared caches don't serve a no-CORS response to an allowed origin
    const hasDynamicOrigin = typeof this.corsConfig.origin !== 'string';
    if (!isPreflight && hasDynamicOrigin) {
      return { Vary: 'Origin' };
    }

    return undefined;
  }

  private applyHeaders(
    response: FinalizedHTTPResponse,
    corsHeaders: Record<string, string> | undefined,
  ): FinalizedHTTPResponse {
    if (!corsHeaders) {
      return response;
    }
    return { ...response, headers: { ...response.headers, ...corsHeaders } };
  }

  private async buildPreflightResult(
    normalizedEvent: NormalizedHTTPEvent,
    event: TEvent,
  ): Promise<TResult | undefined> {
    const methods = this.router.getMethodsForPath(normalizedEvent.path);
    if (methods.length === 0) {
      return undefined;
    }

    const corsHeaders = await this.getCorsHeaders(normalizedEvent, true, methods);
    if (!corsHeaders) {
      return undefined;
    }

    return this.adapter.buildResult({ statusCode: 204, body: '', headers: corsHeaders }, event);
  }

  async handleEvent(event: TEvent, context: Context): Promise<TResult> {
    const normalizedEvent = this.adapter.normalize(event);
    const { method, path } = normalizedEvent;

    const filterInput: HTTPFilterInput<TEvent> = {
      method,
      path,
      headers: normalizedEvent.headers,
      query: normalizedEvent.query,
      body: normalizedEvent.body,
      auth: normalizedEvent.auth,
      event,
    };
    const routeData = await this.router.match(method, path, filterInput);
    if (!routeData) {
      // Match registered OPTIONS route first, use  automatic fallback if one does not exist but CORS i
      if (method === 'OPTIONS' && this.corsConfig) {
        const preflightResult = await this.buildPreflightResult(normalizedEvent, event);
        if (preflightResult !== undefined) {
          return preflightResult;
        }
      }

      // TODO: Could / should these notFound responses deal with CORS so we don't have to repeat here? Does it make sense?
      const notFoundResponse = this.response.notFound();
      const corsHeaders = await this.getCorsHeaders(normalizedEvent, false);
      const responseWithHeaders = this.applyHeaders(notFoundResponse, corsHeaders);
      return this.adapter.buildResult(responseWithHeaders, event);
    }

    const { route, params } = routeData;
    const request = new Request(normalizedEvent, event, context, route, params);

    try {
      await request.validate();
      const requestData = request.buildApiRequest();

      const allMiddleware = [...this.middleware, ...route.middleware];
      const handlerResponse = await handleEventWithMiddleware(allMiddleware, requestData, route.handler);

      const response = this.response.create(handlerResponse);
      const corsHeaders = await this.getCorsHeaders(normalizedEvent, false);
      const responseWithHeaders = this.applyHeaders(response, corsHeaders);
      return this.adapter.buildResult(responseWithHeaders, event);
    } catch (error) {
      const corsHeaders = await this.getCorsHeaders(normalizedEvent, false);
      if (Response.isHTTPResponse(error)) {
        const response = this.response.create(error);
        const responseWithHeaders = this.applyHeaders(response, corsHeaders);
        return this.adapter.buildResult(responseWithHeaders, event);
      }
      logger.error(`Unhandled error processing HTTP request`, { error });
      const errorMessage = error instanceof Error ? error.message : undefined;
      const errorResponse = this.response.internalServerError(errorMessage);
      const responseWithHeaders = this.applyHeaders(errorResponse, corsHeaders);
      return this.adapter.buildResult(responseWithHeaders, event);
    }
  }
}
