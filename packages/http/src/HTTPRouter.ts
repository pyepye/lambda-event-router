import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import { handleEventWithMiddleware, logger, validateSchemaResult } from '@lambda-event-router/base';

import type { AuthPreset } from './auth.js';
import { buildCorsHeaders, type CorsConfig } from './cors.js';
import {
  type BodyRouteMethodFn,
  type InternalRoute,
  type NoBodyRouteMethodFn,
  PathRouter,
  type RouteMethodFn,
} from './PathRouter.js';
import { Request, type RouterRequest } from './Request.js';
import { Response } from './Response.js';
import type {
  AnyHttpMethod,
  ApiRequest,
  DefaultBody,
  FinalizedHTTPResponse,
  HandlerResponse,
  HTTPAdapter,
  HTTPFilterInput,
  HttpMethod,
  NormalizedHTTPEvent,
  PathParams,
  RouteDefinition,
  ValidPath,
} from './types.js';

// Compute response type from schema - if no schema provided, body is untyped (unknown)
type ResponseType<TResponseSchema> = TResponseSchema extends StandardSchemaV1<unknown, infer R> ? R : unknown;

// Config without handler (for builder pattern)
interface RouteInput<
  TPathString extends string,
  TMethod extends AnyHttpMethod,
  TQuerySchema extends StandardSchemaV1 | undefined,
  TBodySchema extends StandardSchemaV1 | undefined,
  TResponseSchema extends StandardSchemaV1 | undefined,
  TRawAuth,
  TRouteAuth,
  TPath = PathParams<TPathString>,
  TQuery = TQuerySchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TQuerySchema>
    : Record<string, string | undefined>,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : DefaultBody<TMethod>,
  TResponse = TResponseSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TResponseSchema> : unknown,
> {
  filters: {
    method: TMethod;
    path: ValidPath<TPathString>;
    custom?: (input: HTTPFilterInput<unknown, TRawAuth>) => boolean | Promise<boolean>;
  };
  auth?: AuthPreset<TRawAuth, TRouteAuth>;
  middleware?: Middleware<ApiRequest<TPath, TQuery, NoInfer<TRouteAuth>, TBody>, HandlerResponse<TResponse>>[];
  querySchema?: TQuerySchema;
  bodySchema?: TBodySchema;
  responseSchema?: TResponseSchema;
}

// Builder that provides typed handle method
interface RouteBuilder<
  TPathString extends string,
  TPath,
  TQuery,
  TAuth,
  TBody,
  TResponse,
  TMethod extends AnyHttpMethod,
  TRawAuth,
> {
  handle(
    handler: (request: ApiRequest<TPath, TQuery, TAuth, TBody>) => Promise<HandlerResponse<TResponse>>,
  ): RouteDefinition<TPathString, TPath, TQuery, TAuth, TBody, TResponse, TMethod, TRawAuth>;
}

export type DefineRouteFn<TRawAuth, TDefaultAuth extends TRawAuth = TRawAuth> = <
  TPathString extends string,
  TMethod extends AnyHttpMethod,
  TQuerySchema extends StandardSchemaV1 | undefined = undefined,
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TResponseSchema extends StandardSchemaV1 | undefined = undefined,
  TPath = PathParams<TPathString>,
  TQuery = TQuerySchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TQuerySchema>
    : Record<string, string | undefined>,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : DefaultBody<TMethod>,
  TResponse = ResponseType<TResponseSchema>,
  TRouteAuth extends TRawAuth = TDefaultAuth,
>(
  config: RouteInput<TPathString, TMethod, TQuerySchema, TBodySchema, TResponseSchema, TRawAuth, TRouteAuth>,
) => RouteBuilder<TPathString, TPath, TQuery, TRouteAuth, TBody, TResponse, TMethod, TRawAuth>;

export function createDefineRoute<TRawAuth, TDefaultAuth extends TRawAuth = TRawAuth>(): DefineRouteFn<
  TRawAuth,
  TDefaultAuth
> {
  return defineRouteWithAuth;
}

function defineRouteWithAuth<
  TPathString extends string,
  TMethod extends AnyHttpMethod,
  TQuerySchema extends StandardSchemaV1 | undefined = undefined,
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TResponseSchema extends StandardSchemaV1 | undefined = undefined,
  TPath = PathParams<TPathString>,
  TQuery = TQuerySchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TQuerySchema>
    : Record<string, string | undefined>,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : DefaultBody<TMethod>,
  TResponse = ResponseType<TResponseSchema>,
  TRouteAuth = unknown,
  TRawAuth = TRouteAuth,
>(
  config: RouteInput<TPathString, TMethod, TQuerySchema, TBodySchema, TResponseSchema, TRawAuth, TRouteAuth>,
): RouteBuilder<TPathString, TPath, TQuery, TRouteAuth, TBody, TResponse, TMethod, TRawAuth> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): RouteDefinition<TPathString, TPath, TQuery, TRouteAuth, TBody, TResponse, TMethod, TRawAuth> {
      return { ...config, handler } as RouteDefinition<
        TPathString,
        TPath,
        TQuery,
        TRouteAuth,
        TBody,
        TResponse,
        TMethod,
        TRawAuth
      >;
    },
  };
}

export const defineRoute: DefineRouteFn<unknown> = createDefineRoute<unknown>();

interface HTTPRouterOptions<TEvent, TResult, TAuth, TDefaultAuth extends TAuth> {
  adapter: HTTPAdapter<TEvent, TResult, TAuth>;
  auth?: AuthPreset<TAuth, TDefaultAuth>;
  middleware?: Middleware<RouterRequest<TAuth>, HandlerResponse>[];
  cors?: CorsConfig;
}

export class HTTPRouter<TEvent, TResult, TAuth = unknown, TDefaultAuth extends TAuth = TAuth>
  implements EventTypeRouter<TEvent, TResult>
{
  private router = new PathRouter<TAuth, TDefaultAuth>();
  private defaultAuth: AuthPreset<TAuth, TDefaultAuth> | undefined;
  private response = new Response();
  private middleware: Middleware<RouterRequest<TAuth>, HandlerResponse>[];
  private adapter: HTTPAdapter<TEvent, TResult, TAuth>;
  private corsConfig: CorsConfig | undefined;

  constructor(options: HTTPAdapter<TEvent, TResult, TAuth> | HTTPRouterOptions<TEvent, TResult, TAuth, TDefaultAuth>) {
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
      this.defaultAuth = options.auth;
    }
  }

  defineRoute: DefineRouteFn<TAuth, TDefaultAuth> = createDefineRoute<TAuth, TDefaultAuth>();

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from RouteMethodFn<this>
  route: RouteMethodFn<this, TAuth, TDefaultAuth> = (definition) => {
    this.router.route(definition);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  get: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth> = (config) => {
    this.router.get(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from BodyRouteMethodFn<this>
  post: BodyRouteMethodFn<this, TAuth, TDefaultAuth> = (config) => {
    this.router.post(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from BodyRouteMethodFn<this>
  put: BodyRouteMethodFn<this, TAuth, TDefaultAuth> = (config) => {
    this.router.put(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from BodyRouteMethodFn<this>
  patch: BodyRouteMethodFn<this, TAuth, TDefaultAuth> = (config) => {
    this.router.patch(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  delete: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth> = (config) => {
    this.router.delete(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  head: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth> = (config) => {
    this.router.head(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  options: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth> = (config) => {
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

  private async checkAuth(route: InternalRoute<TAuth>, auth: TAuth): Promise<TAuth> {
    const preset = route.auth ?? this.defaultAuth;
    if (!preset) return auth;

    const result = await preset.check(auth);
    if (result.success) return result.auth;

    const failure = { preset: preset.name, reason: result.reason, message: result.message, issues: result.issues };
    if (result.reason === 'missing') {
      logger.warn('Request auth does not match the auth preset', failure);
      throw Response.Unauthorised();
    }
    if (result.reason === 'invalid') {
      logger.warn('Request auth does not match the auth preset', failure);
      throw Response.Forbidden();
    }
    logger.error('Request auth does not match the auth preset', failure);
    throw Response.InternalServerError();
  }

  private async validateResponse(route: InternalRoute<TAuth>, handlerResponse: unknown): Promise<unknown> {
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
    normalizedEvent: NormalizedHTTPEvent<TAuth>,
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

    return this.adapter.buildResult({ statusCode: 204, body: '', headers: corsHeaders, isBase64Encoded: false }, event);
  }

  async handleEvent(event: TEvent, context: Context): Promise<TResult> {
    const normalizedEvent = this.adapter.normalize(event);
    const { method, path } = normalizedEvent;

    const filterInput: HTTPFilterInput<TEvent, TAuth> = {
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
      const finalResponse = this.stripBodyForHead(responseWithHeaders, method);
      return this.adapter.buildResult(finalResponse, event);
    }

    const { route, params } = routeData;

    try {
      const auth = await this.checkAuth(route, normalizedEvent.auth);
      const request = new Request({ ...normalizedEvent, auth }, event, context, route, params);
      const query = await request.validateQuery();
      const body = await request.validateBody();
      const requestData = request.buildApiRequest(query, body);

      const allMiddleware = [...this.middleware, ...route.middleware];
      const handlerResponse = await handleEventWithMiddleware(allMiddleware, requestData, route.handler);

      const validatedResponse = await this.validateResponse(route, handlerResponse);
      const response = this.response.create(validatedResponse);
      const corsHeaders = await this.getCorsHeaders(normalizedEvent, false);
      const responseWithHeaders = this.applyHeaders(response, corsHeaders);
      const finalResponse = this.stripBodyForHead(responseWithHeaders, method);
      return this.adapter.buildResult(finalResponse, event);
    } catch (error) {
      const corsHeaders = await this.getCorsHeaders(normalizedEvent, false);
      if (Response.isHTTPResponse(error)) {
        const response = this.response.create(error);
        const responseWithHeaders = this.applyHeaders(response, corsHeaders);
        const finalResponse = this.stripBodyForHead(responseWithHeaders, method);
        return this.adapter.buildResult(finalResponse, event);
      }
      logger.error(`Unhandled error processing HTTP request`, { error });
      const errorMessage = error instanceof Error ? error.message : undefined;
      const errorResponse = this.response.internalServerError(errorMessage);
      const responseWithHeaders = this.applyHeaders(errorResponse, corsHeaders);
      const finalResponse = this.stripBodyForHead(responseWithHeaders, method);
      return this.adapter.buildResult(finalResponse, event);
    }
  }
}
