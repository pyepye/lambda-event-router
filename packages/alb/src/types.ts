import type { ALBEvent } from 'aws-lambda';

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
type DefaultEvent = ALBEvent;

export type ApiRequest<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TAuth extends DefaultAuth = DefaultAuth,
  TBody = unknown,
  TEvent = DefaultEvent,
> = HTTPApiRequest<TPath, TQuery, TAuth, TBody, TEvent>;

export type ApiHandler<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TAuth extends DefaultAuth = DefaultAuth,
  TBody = unknown,
  TResponse = JsonBody,
  TEvent = DefaultEvent,
> = HTTPApiHandler<TPath, TQuery, TAuth, TBody, TResponse, TEvent>;

export type HTTPMiddleware<
  TPath = Record<string, string>,
  TQuery = Record<string, unknown>,
  TAuth extends DefaultAuth = DefaultAuth,
  TBody = unknown,
  TResponse = AnyResponseKind,
  TEvent = DefaultEvent,
> = HTTPMiddlewareBase<TPath, TQuery, TAuth, TBody, TResponse, TEvent>;

export type HTTPFilterInput<TEvent = DefaultEvent, TAuth = DefaultAuth> = HTTPFilterInputBase<TEvent, TAuth>;

export type HTTPFilters<
  TPathString extends string = string,
  TMethod extends AnyHttpMethod = AnyHttpMethod,
  TAuth = DefaultAuth,
  TEvent = DefaultEvent,
> = HTTPFiltersBase<TPathString, TMethod, TAuth, TEvent>;

export type RouteDefinition<
  TPathString extends string = string,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TAuth extends DefaultAuth = DefaultAuth,
  TBody = unknown,
  TResponse = JsonBody,
  TMethod extends AnyHttpMethod = AnyHttpMethod,
  TEvent = DefaultEvent,
> = HTTPRouteDefinition<
  TPathString,
  TPath,
  TQuery,
  TAuth,
  TBody,
  TResponse,
  TMethod,
  DefaultAuth,
  'json',
  string,
  TEvent
>;
