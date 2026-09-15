import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import { handleEventWithMiddleware, logger, validateSchemaResult } from '@lambda-event-router/base';

import type { AuthPreset } from './auth.js';
import { HTTP_STATUS_CODES, statusName } from './constants.js';
import { buildCorsHeaders, type CorsConfig } from './cors.js';
import { defaultJsonErrorBody, defaultTextErrorBody, fallbackServerError } from './errorBodies.js';
import { HTTPException } from './HTTPException.js';
import {
  type BodyRouteMethodFn,
  type InternalRoute,
  type NoBodyRouteMethodFn,
  PathRouter,
  type RouteMethodFn,
} from './PathRouter.js';
import { Request, type RouterRequest } from './Request.js';
import { Response } from './Response.js';
import {
  DEFAULT_CONTENT_TYPES,
  JSON_RESPONSE_TYPE,
  type ResolvedResponseType,
  resolveResponseType,
} from './responseType.js';
import type {
  AnyHttpMethod,
  ApiHandler,
  ApiRequest,
  DefaultBody,
  ErrorFunctions,
  FinalizedHTTPResponse,
  HandlerResponse,
  HTTPAdapter,
  HTTPFilterInput,
  HtmlRouterErrors,
  HttpMethod,
  NormalizedHTTPEvent,
  OneKind,
  PathParams,
  ResponseBody,
  ResponseKind,
  ResponseTypeOption,
  RouteDefinition,
  ValidPath,
} from './types.js';

type SchemaOutput<TResponseSchema, TFallback> =
  TResponseSchema extends StandardSchemaV1<unknown, infer R> ? R : TFallback;

type ErrorKind = keyof ErrorFunctions;

// Config without handler (for builder pattern)
interface RouteInput<
  TPathString extends string,
  TMethod extends AnyHttpMethod,
  TQuerySchema extends StandardSchemaV1 | undefined,
  TBodySchema extends StandardSchemaV1 | undefined,
  TResponseSchema extends StandardSchemaV1<unknown, ResponseBody<TKind>> | undefined,
  TRawAuth,
  TRouteAuth,
  TKind extends ResponseKind,
  TContentType extends string,
  TEvent,
  TPath = PathParams<TPathString>,
  TQuery = TQuerySchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TQuerySchema>
    : Record<string, string | undefined>,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : DefaultBody<TMethod>,
  TResponse = SchemaOutput<TResponseSchema, ResponseBody<TKind>>,
> {
  filters: {
    method: TMethod;
    path: ValidPath<TPathString>;
    custom?: (input: HTTPFilterInput<TEvent, TRawAuth>) => boolean | Promise<boolean>;
  };
  auth?: AuthPreset<TRawAuth, TRouteAuth>;
  responseType?: ResponseTypeOption<TKind, TContentType>;
  middleware?: Middleware<ApiRequest<TPath, TQuery, NoInfer<TRouteAuth>, TBody, TEvent>, HandlerResponse<TResponse>>[];
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
  TKind extends ResponseKind,
  TContentType extends string,
  TEvent,
> {
  handle(
    handler: ApiHandler<TPath, TQuery, TAuth, TBody, TResponse, TEvent>,
  ): RouteDefinition<
    TPathString,
    TPath,
    TQuery,
    TAuth,
    TBody,
    TResponse,
    TMethod,
    TRawAuth,
    TKind,
    TContentType,
    TEvent
  >;
}

export type DefineRouteFn<
  TRawAuth,
  TDefaultAuth extends TRawAuth = TRawAuth,
  TDefaultKind extends ResponseKind = 'json',
  TEvent = unknown,
> = <
  TPathString extends string,
  TMethod extends AnyHttpMethod,
  TKind extends ResponseKind = TDefaultKind,
  TContentType extends string = string,
  TQuerySchema extends StandardSchemaV1 | undefined = undefined,
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TResponseSchema extends StandardSchemaV1<unknown, ResponseBody<TKind>> | undefined = undefined,
  TPath = PathParams<TPathString>,
  TQuery = TQuerySchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TQuerySchema>
    : Record<string, string | undefined>,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : DefaultBody<TMethod>,
  TResponse = SchemaOutput<TResponseSchema, ResponseBody<TKind>>,
  TRouteAuth extends TRawAuth = TDefaultAuth,
>(
  config: RouteInput<
    TPathString,
    TMethod,
    TQuerySchema,
    TBodySchema,
    TResponseSchema,
    TRawAuth,
    TRouteAuth,
    TKind,
    TContentType,
    TEvent
  > &
    OneKind<NoInfer<TKind>>,
) => RouteBuilder<
  TPathString,
  TPath,
  TQuery,
  TRouteAuth,
  TBody,
  TResponse,
  TMethod,
  TRawAuth,
  TKind,
  TContentType,
  TEvent
>;

function defineRouteWithDefault<TRawAuth, TDefaultAuth extends TRawAuth, TDefaultKind extends ResponseKind, TEvent>(
  defaultResponseType: ResponseTypeOption,
): DefineRouteFn<TRawAuth, TDefaultAuth, TDefaultKind, TEvent> {
  return function defineRouteWithAuth<
    TPathString extends string,
    TMethod extends AnyHttpMethod,
    TKind extends ResponseKind = TDefaultKind,
    TContentType extends string = string,
    TQuerySchema extends StandardSchemaV1 | undefined = undefined,
    TBodySchema extends StandardSchemaV1 | undefined = undefined,
    TResponseSchema extends StandardSchemaV1<unknown, ResponseBody<TKind>> | undefined = undefined,
    TPath = PathParams<TPathString>,
    TQuery = TQuerySchema extends StandardSchemaV1
      ? StandardSchemaV1.InferOutput<TQuerySchema>
      : Record<string, string | undefined>,
    TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : DefaultBody<TMethod>,
    TResponse = SchemaOutput<TResponseSchema, ResponseBody<TKind>>,
    TRouteAuth extends TRawAuth = TDefaultAuth,
  >(
    config: RouteInput<
      TPathString,
      TMethod,
      TQuerySchema,
      TBodySchema,
      TResponseSchema,
      TRawAuth,
      TRouteAuth,
      TKind,
      TContentType,
      TEvent
    > &
      OneKind<NoInfer<TKind>>,
  ): RouteBuilder<
    TPathString,
    TPath,
    TQuery,
    TRouteAuth,
    TBody,
    TResponse,
    TMethod,
    TRawAuth,
    TKind,
    TContentType,
    TEvent
  > {
    return {
      // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
      handle(
        handler,
      ): RouteDefinition<
        TPathString,
        TPath,
        TQuery,
        TRouteAuth,
        TBody,
        TResponse,
        TMethod,
        TRawAuth,
        TKind,
        TContentType,
        TEvent
      > {
        // The route keeps the kind its handler was typed for, whatever the default of the router it joins
        return { ...config, responseType: config.responseType ?? defaultResponseType, handler } as RouteDefinition<
          TPathString,
          TPath,
          TQuery,
          TRouteAuth,
          TBody,
          TResponse,
          TMethod,
          TRawAuth,
          TKind,
          TContentType,
          TEvent
        >;
      },
    };
  };
}

export function createDefineRoute<
  TRawAuth,
  TDefaultAuth extends TRawAuth = TRawAuth,
  TEvent = unknown,
>(): DefineRouteFn<TRawAuth, TDefaultAuth, 'json', TEvent> {
  return defineRouteWithDefault<TRawAuth, TDefaultAuth, 'json', TEvent>('json');
}

export const defineRoute: DefineRouteFn<unknown> = createDefineRoute<unknown>();

export interface HTTPRouterOptions<
  TEvent,
  TResult,
  TAuth,
  TDefaultAuth extends TAuth,
  TDefaultKind extends ResponseKind,
  TErrors extends ErrorFunctions,
  TContentType extends string,
> {
  adapter: HTTPAdapter<TEvent, TResult, TAuth>;
  auth?: AuthPreset<TAuth, TDefaultAuth>;
  responseType?: ResponseTypeOption<TDefaultKind, TContentType>;
  errors?: TErrors & ErrorFunctions;
  middleware?: Middleware<RouterRequest<TAuth, TEvent>, HandlerResponse<ResponseBody>>[];
  cors?: CorsConfig;
}

export class HTTPRouter<
  TEvent,
  TResult,
  TAuth = unknown,
  TDefaultAuth extends TAuth = TAuth,
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
> implements EventTypeRouter<TEvent, TResult>
{
  private router = new PathRouter<TAuth, TDefaultAuth, TDefaultKind, TErrors, TEvent>();
  private defaultAuth: AuthPreset<TAuth, TDefaultAuth> | undefined;
  private response = new Response();
  private middleware: Middleware<RouterRequest<TAuth, TEvent>, HandlerResponse<ResponseBody>>[];
  private adapter: HTTPAdapter<TEvent, TResult, TAuth>;
  private corsConfig: CorsConfig | undefined;
  private defaultResponseType: ResolvedResponseType = JSON_RESPONSE_TYPE;
  private errors: ErrorFunctions = {};

  defineRoute: DefineRouteFn<TAuth, TDefaultAuth, TDefaultKind, TEvent>;

  constructor(
    options:
      | HTTPAdapter<TEvent, TResult, TAuth>
      | (HTTPRouterOptions<TEvent, TResult, TAuth, TDefaultAuth, TDefaultKind, TErrors, TContentType> &
          HtmlRouterErrors<NoInfer<TDefaultKind>>),
  ) {
    if ('canHandleEvent' in options) {
      this.adapter = options;
      this.middleware = [];
      this.defineRoute = defineRouteWithDefault<TAuth, TDefaultAuth, TDefaultKind, TEvent>('json');
      return;
    }

    if (options.cors?.credentials && options.cors.origin === '*') {
      throw new Error('CORS configuration error: credentials cannot be used with wildcard (*) origin');
    }
    this.adapter = options.adapter;
    this.middleware = options.middleware ?? [];
    this.corsConfig = options.cors;
    this.defaultAuth = options.auth;
    this.errors = options.errors ?? {};
    this.defaultResponseType = resolveResponseType(options.responseType, JSON_RESPONSE_TYPE);
    if (this.defaultResponseType.kind === 'html' && !this.errors.html) {
      throw new Error('Response type configuration error: an HTML router needs errors.html');
    }
    this.defineRoute = defineRouteWithDefault<TAuth, TDefaultAuth, TDefaultKind, TEvent>(
      options.responseType ?? 'json',
    );
  }

  private checkRouteResponseType(responseType: ResponseTypeOption | undefined): void {
    const { kind } = resolveResponseType(responseType, this.defaultResponseType);
    // TypeScript already rejects this. The check is for JavaScript callers and casts
    if (kind === 'html' && !this.errors.html) {
      throw new Error('Response type configuration error: an HTML route needs errors.html on its router');
    }
  }

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from RouteMethodFn<this>
  route: RouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors, TEvent> = (definition) => {
    this.checkRouteResponseType(definition.responseType);
    this.router.route(definition);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  get: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors, TEvent> = (config) => {
    this.checkRouteResponseType(config.responseType);
    this.router.get(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from BodyRouteMethodFn<this>
  post: BodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors, TEvent> = (config) => {
    this.checkRouteResponseType(config.responseType);
    this.router.post(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from BodyRouteMethodFn<this>
  put: BodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors, TEvent> = (config) => {
    this.checkRouteResponseType(config.responseType);
    this.router.put(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from BodyRouteMethodFn<this>
  patch: BodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors, TEvent> = (config) => {
    this.checkRouteResponseType(config.responseType);
    this.router.patch(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  delete: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors, TEvent> = (config) => {
    this.checkRouteResponseType(config.responseType);
    this.router.delete(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  head: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors, TEvent> = (config) => {
    this.checkRouteResponseType(config.responseType);
    this.router.head(config);
    return this;
  };

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn<this>
  options: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors, TEvent> = (config) => {
    this.checkRouteResponseType(config.responseType);
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

  // Bytes are never an error body, so a binary route's errors use the router's kind, and a binary router's use JSON
  private errorKind(kind: ResponseKind): ErrorKind {
    if (kind !== 'binary') return kind;
    const routerKind = this.defaultResponseType.kind;
    return routerKind === 'binary' ? 'json' : routerKind;
  }

  private errorBody(exception: HTTPException, kind: ErrorKind): unknown {
    const { statusCode, message, context } = exception;
    const errorFunction = this.errors[kind];
    if (errorFunction) {
      return errorFunction({ statusCode, statusText: statusName(statusCode), message, context });
    }
    if (kind === 'text') return defaultTextErrorBody(exception);
    // Setup rejects an HTML route or router with no errors.html, so the kind here is json
    return defaultJsonErrorBody(exception);
  }

  private async renderError(exception: HTTPException, routeKind: ResponseKind): Promise<FinalizedHTTPResponse> {
    const kind = this.errorKind(routeKind);
    let body: unknown;
    try {
      body = await this.errorBody(exception, kind);
    } catch (error) {
      logger.error('Error response body could not be built', { statusCode: exception.statusCode, error });
      // Uses routeKind because a binary route sends JSON errors but a plain-text fallback
      return fallbackServerError(routeKind);
    }

    const responseType = { kind, contentType: DEFAULT_CONTENT_TYPES[kind] };
    try {
      return this.response.create({ statusCode: exception.statusCode, body, headers: exception.headers }, responseType);
    } catch {
      return fallbackServerError(routeKind);
    }
  }

  private async createErrorResponse(
    error: unknown,
    responseType: ResolvedResponseType,
  ): Promise<FinalizedHTTPResponse> {
    if (Response.isHTTPResponse(error)) {
      try {
        return this.response.create(error, responseType);
      } catch {
        return this.renderError(Response.InternalServerError(), responseType.kind);
      }
    }
    if (error instanceof HTTPException) {
      return this.renderError(error, responseType.kind);
    }

    // The message of an unexpected error can hold internal detail, so only the log sees it
    logger.error('Unhandled error processing HTTP request', { error });
    return this.renderError(Response.InternalServerError(), responseType.kind);
  }

  private async checkAuth(route: InternalRoute<TAuth>, auth: TAuth): Promise<TAuth> {
    const preset = route.auth ?? this.defaultAuth;
    if (!preset) return auth;

    const result = await preset.check(auth);
    if (result.success) return result.auth;

    const failure = { preset: preset.name, reason: result.reason, message: result.message, issues: result.issues };
    if (result.reason === 'missing') {
      logger.warn('Request auth does not match the auth preset', failure);
      throw Response.Unauthorized();
    }
    if (result.reason === 'invalid') {
      logger.warn('Request auth does not match the auth preset', failure);
      throw Response.Forbidden();
    }
    logger.error('Request auth does not match the auth preset', failure);
    throw Response.InternalServerError();
  }

  private async validateResponseBody(responseSchema: StandardSchemaV1, body: unknown): Promise<unknown> {
    const result = await validateSchemaResult(body, responseSchema);
    if (!result.success) {
      logger.error('Handler response failed its responseSchema', { issues: result.issues });
      throw Response.InternalServerError();
    }
    return result.data;
  }

  private async validateResponse(route: InternalRoute<TAuth>, handlerResponse: unknown): Promise<unknown> {
    if (!route.responseSchema) {
      return handlerResponse;
    }
    if (!Response.isHTTPResponse(handlerResponse)) {
      return this.validateResponseBody(route.responseSchema, handlerResponse);
    }

    const { statusCode } = handlerResponse;
    // Only a 2xx carries the body the route promises. Any other status is the handler choosing an error or a redirect
    const isSuccess = statusCode >= HTTP_STATUS_CODES.OK && statusCode < HTTP_STATUS_CODES.MULTIPLE_CHOICES;
    if (!isSuccess) {
      return handlerResponse;
    }
    const body = await this.validateResponseBody(route.responseSchema, handlerResponse.body);
    return { ...handlerResponse, body };
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
      const notFoundResponse = await this.renderError(Response.NotFound(), this.defaultResponseType.kind);
      const corsHeaders = await this.getCorsHeaders(normalizedEvent, false);
      const responseWithHeaders = this.applyHeaders(notFoundResponse, corsHeaders);
      const finalResponse = this.stripBodyForHead(responseWithHeaders, method);
      return this.adapter.buildResult(finalResponse, event);
    }

    const { route, params } = routeData;
    const responseType = resolveResponseType(route.responseType, this.defaultResponseType);

    try {
      const auth = await this.checkAuth(route, normalizedEvent.auth);
      const request = new Request({ ...normalizedEvent, auth }, event, context, route, params);
      const query = await request.validateQuery();
      const body = await request.validateBody();
      const requestData = request.buildApiRequest(query, body);

      const allMiddleware = [...this.middleware, ...route.middleware];
      const handlerResponse = await handleEventWithMiddleware(allMiddleware, requestData, route.handler);
      if (handlerResponse instanceof HTTPException) {
        throw handlerResponse;
      }

      const validatedResponse = await this.validateResponse(route, handlerResponse);
      const response = this.response.create(validatedResponse, responseType);
      const corsHeaders = await this.getCorsHeaders(normalizedEvent, false);
      const responseWithHeaders = this.applyHeaders(response, corsHeaders);
      const finalResponse = this.stripBodyForHead(responseWithHeaders, method);
      return this.adapter.buildResult(finalResponse, event);
    } catch (error) {
      const corsHeaders = await this.getCorsHeaders(normalizedEvent, false);
      const errorResponse = await this.createErrorResponse(error, responseType);
      const responseWithHeaders = this.applyHeaders(errorResponse, corsHeaders);
      const finalResponse = this.stripBodyForHead(responseWithHeaders, method);
      return this.adapter.buildResult(finalResponse, event);
    }
  }
}
