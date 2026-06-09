import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import { handleEventWithMiddleware, logger, validateSchemaResult } from '@lambda-event-router/base';

import { buildCorsHeaders, type CorsConfig } from './cors.js';
import {
  type BodyRouteMethodFn,
  type InternalRoute,
  type NoBodyRouteMethodFn,
  PathRouter,
  type RouteMethodFn,
} from './PathRouter.js';
import { Request } from './Request.js';
import { Response } from './Response.js';
import type {
  AnyHttpMethod,
  ApiRequest,
  ContentType,
  ContentTypeResponse,
  FinalizedHTTPResponse,
  HandlerResponse,
  HTTPAdapter,
  HTTPErrorHandler,
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
  TContentType,
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
    custom?: (input: HTTPFilterInput) => boolean | Promise<boolean>;
  };
  middleware?: Middleware<ApiRequest<TPath, TQuery, TBody>, HandlerResponse<TResponse>>[];
  querySchema?: TQuerySchema;
  bodySchema?: TBodySchema;
  responseSchema?: TResponseSchema;
  contentType?: TContentType;
}

// Builder that provides typed handle method
interface RouteBuilder<TPathString extends string, TPath, TQuery, TBody, TResponse, TContentType> {
  handle(
    handler: (request: ApiRequest<TPath, TQuery, TBody>) => Promise<ContentTypeResponse<TContentType, TResponse>>,
  ): RouteDefinition<TPathString, TPath, TQuery, TBody, TResponse>;
}

export function defineRoute<
  TPathString extends string,
  TQuerySchema extends StandardSchemaV1 | undefined = undefined,
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TResponseSchema extends StandardSchemaV1 | undefined = undefined,
  TContentType extends ContentType | undefined = undefined,
  TPath = PathParams<TPathString>,
  TQuery = TQuerySchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TQuerySchema>
    : Record<string, string | undefined>,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
  TResponse = ResponseType<TResponseSchema>,
>(
  config: RouteInput<TPathString, TQuerySchema, TBodySchema, TResponseSchema, TContentType>,
): RouteBuilder<TPathString, TPath, TQuery, TBody, TResponse, TContentType> {
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
  contentType?: ContentType;
  onError?: HTTPErrorHandler;
}

export class HTTPRouter<TEvent, TResult> implements EventTypeRouter<TEvent, TResult> {
  private router = new PathRouter();
  private response = new Response();
  private middleware: Middleware<ApiRequest, HandlerResponse>[];
  private adapter: HTTPAdapter<TEvent, TResult>;
  private corsConfig: CorsConfig | undefined;
  private contentType: ContentType | undefined;
  private onError: HTTPErrorHandler | undefined;

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
      this.contentType = options.contentType;
      this.onError = options.onError;
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

  // RFC 9110: a HEAD response carries no content but keeps the status and headers a GET would return
  private stripBodyForHead(response: FinalizedHTTPResponse, method: string): FinalizedHTTPResponse {
    if (method !== 'HEAD') {
      return response;
    }
    return { ...response, body: '' };
  }

  private async validateResponse(route: InternalRoute, handlerResponse: unknown): Promise<unknown> {
    if (!route.responseSchema || Response.isHTTPResponse(handlerResponse)) {
      return handlerResponse;
    }

    const result = await validateSchemaResult(handlerResponse, route.responseSchema);
    if (!result.success) {
      logger.error('Handler response failed its responseSchema', { issues: result.issues });
      throw Response.InternalServerError();
    }
    return result.data;
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

  private finalise(
    rawResponse: unknown,
    contentType: ContentType | undefined,
    corsHeaders: Record<string, string> | undefined,
    method: string,
    event: TEvent,
  ): TResult {
    const response = this.response.create(rawResponse, contentType);
    const responseWithHeaders = this.applyHeaders(response, corsHeaders);
    const finalResponse = this.stripBodyForHead(responseWithHeaders, method);
    return this.adapter.buildResult(finalResponse, event);
  }

  // A text content type renders the message as plain text, otherwise as a JSON error object
  private buildErrorResponse(
    statusCode: number,
    message: string,
    contentType: ContentType | undefined,
  ): HandlerResponse {
    if (contentType?.startsWith('text/')) {
      return { statusCode, body: message, headers: { 'content-type': 'text/plain; charset=utf-8' } };
    }
    return { statusCode, body: { error: message } };
  }

  // A best-effort request for onError when no route matched or validation threw before one was built
  private buildEventApiRequest(normalizedEvent: NormalizedHTTPEvent, event: TEvent, context: Context): ApiRequest {
    return {
      method: normalizedEvent.method,
      path: {},
      rawPath: normalizedEvent.path,
      query: normalizedEvent.query,
      multiValueQuery: normalizedEvent.multiValueQuery,
      auth: normalizedEvent.auth,
      body: undefined,
      headers: normalizedEvent.headers,
      multiValueHeaders: normalizedEvent.multiValueHeaders,
      event,
      context,
    };
  }

  private async renderError(
    statusCode: number,
    defaultResponse: HandlerResponse,
    body: unknown,
    error: unknown,
    request: ApiRequest,
    contentType: ContentType | undefined,
    corsHeaders: Record<string, string> | undefined,
    method: string,
    event: TEvent,
  ): Promise<TResult> {
    if (this.onError) {
      const override = await this.onError({ statusCode, body, request, error });
      if (override !== undefined) {
        // A bare body keeps the error status, a full response is used as given
        const response = Response.isHTTPResponse(override) ? override : { statusCode, body: override };
        return this.finalise(response, contentType, corsHeaders, method, event);
      }
    }
    return this.finalise(defaultResponse, undefined, corsHeaders, method, event);
  }

  async handleEvent(event: TEvent, context: Context): Promise<TResult> {
    const normalizedEvent = this.adapter.normalize(event);
    const { method, path } = normalizedEvent;

    const filterInput: HTTPFilterInput<TEvent> = {
      method,
      path,
      headers: normalizedEvent.headers,
      multiValueHeaders: normalizedEvent.multiValueHeaders,
      query: normalizedEvent.query,
      multiValueQuery: normalizedEvent.multiValueQuery,
      body: normalizedEvent.body,
      auth: normalizedEvent.auth,
      event,
    };
    const routeData = await this.router.match(method, path, filterInput);
    if (!routeData) {
      // Match registered OPTIONS route first, use automatic fallback if one does not exist but CORS is set
      if (method === 'OPTIONS' && this.corsConfig) {
        const preflightResult = await this.buildPreflightResult(normalizedEvent, event);
        if (preflightResult !== undefined) {
          return preflightResult;
        }
      }

      const corsHeaders = await this.getCorsHeaders(normalizedEvent, false);
      const notFound = this.buildErrorResponse(404, 'Not found', this.contentType);
      const request = this.buildEventApiRequest(normalizedEvent, event, context);
      return this.renderError(
        404,
        notFound,
        { error: 'Not found' },
        undefined,
        request,
        this.contentType,
        corsHeaders,
        method,
        event,
      );
    }

    const { route, params } = routeData;
    const contentType = route.contentType ?? this.contentType;
    const request = new Request(normalizedEvent, event, context, route, params);

    let requestData: ApiRequest | undefined;
    try {
      const query = await request.validateQuery();
      const body = await request.validateBody();
      requestData = request.buildApiRequest(query, body);

      const allMiddleware = [...this.middleware, ...route.middleware];
      const handlerResponse = await handleEventWithMiddleware(allMiddleware, requestData, route.handler);

      const validatedResponse = await this.validateResponse(route, handlerResponse);
      const corsHeaders = await this.getCorsHeaders(normalizedEvent, false);
      return this.finalise(validatedResponse, contentType, corsHeaders, method, event);
    } catch (error) {
      const corsHeaders = await this.getCorsHeaders(normalizedEvent, false);
      const apiRequest = requestData ?? request.buildApiRequest(request.queryParams, request.body);
      // A thrown response keeps its own body, an unhandled error becomes a 500 that follows contentType
      if (Response.isHTTPResponse(error)) {
        return this.renderError(
          error.statusCode,
          error,
          error.body,
          error,
          apiRequest,
          contentType,
          corsHeaders,
          method,
          event,
        );
      }
      logger.error('Unhandled error processing HTTP request', { error });
      const message = error instanceof Error ? error.message : 'Internal server error';
      const errorResponse = this.buildErrorResponse(500, message, contentType);
      return this.renderError(
        500,
        errorResponse,
        { error: message },
        error,
        apiRequest,
        contentType,
        corsHeaders,
        method,
        event,
      );
    }
  }
}
