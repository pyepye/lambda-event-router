import type {
  AnyHttpMethod,
  AnyResponseKind,
  ApiHandler as HTTPApiHandler,
  ApiRequest as HTTPApiRequest,
  HTTPFilterInput as HTTPFilterInputBase,
  HTTPFilters as HTTPFiltersBase,
  HTTPMiddleware as HTTPMiddlewareBase,
  RouteDefinition as HTTPRouteDefinition,
  JsonBody,
  PathParams,
} from '@lambda-event-router/http';

// ALB puts no caller on the event, so auth is always undefined
type DefaultAuth = undefined;

export type ApiRequest<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TAuth extends DefaultAuth = DefaultAuth,
  TBody = unknown,
  TEvent = unknown,
> = HTTPApiRequest<TPath, TQuery, TAuth, TBody, TEvent>;

export type ApiHandler<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TAuth extends DefaultAuth = DefaultAuth,
  TBody = unknown,
  TResponse = JsonBody,
> = HTTPApiHandler<TPath, TQuery, TAuth, TBody, TResponse>;

export type HTTPMiddleware<
  TPath = Record<string, string>,
  TQuery = Record<string, unknown>,
  TAuth extends DefaultAuth = DefaultAuth,
  TBody = unknown,
  TResponse = AnyResponseKind,
> = HTTPMiddlewareBase<TPath, TQuery, TAuth, TBody, TResponse>;

export type HTTPFilterInput<TEvent = unknown, TAuth = DefaultAuth> = HTTPFilterInputBase<TEvent, TAuth>;

export type HTTPFilters<
  TPathString extends string = string,
  TMethod extends AnyHttpMethod = AnyHttpMethod,
  TAuth = DefaultAuth,
> = HTTPFiltersBase<TPathString, TMethod, TAuth>;

export type RouteDefinition<
  TPathString extends string = string,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TAuth extends DefaultAuth = DefaultAuth,
  TBody = unknown,
  TResponse = JsonBody,
  TMethod extends AnyHttpMethod = AnyHttpMethod,
> = HTTPRouteDefinition<TPathString, TPath, TQuery, TAuth, TBody, TResponse, TMethod, DefaultAuth>;
