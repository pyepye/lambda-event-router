import type {
  AuthPreset,
  CorsConfig,
  DefineRouteFn,
  ErrorFunctions,
  ResponseBody,
  ResponseTypeOption,
  RouteKind,
} from '@lambda-event-router/http';
import { createDefineRoute, HTTPRouter } from '@lambda-event-router/http';

import { type APIGatewayEvent, type APIGatewayResult, apiGatewayAdapter } from './apiGatewayAdapter.js';
import type { APIGatewayAuth } from './auth.js';
import type { HTTPMiddleware } from './types.js';

type RawAuth = APIGatewayAuth;

export interface APIGatewayRouterOptions<
  TDefaultAuth extends RawAuth = RawAuth,
  TDefaultKind extends RouteKind<TErrors> = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
> {
  auth?: AuthPreset<RawAuth, TDefaultAuth>;
  responseType?: ResponseTypeOption<TDefaultKind, TContentType>;
  errors?: TErrors & ErrorFunctions;
  middleware?: HTTPMiddleware<
    Record<string, string>,
    Record<string, string | undefined>,
    RawAuth,
    unknown,
    ResponseBody
  >[];
  cors?: CorsConfig;
}

export class APIGatewayRouter<
  TDefaultAuth extends RawAuth = RawAuth,
  TDefaultKind extends RouteKind<TErrors> = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
> extends HTTPRouter<APIGatewayEvent, APIGatewayResult, RawAuth, TDefaultAuth, TDefaultKind, TErrors, TContentType> {
  constructor(options?: APIGatewayRouterOptions<TDefaultAuth, TDefaultKind, TErrors, TContentType>) {
    super({
      adapter: apiGatewayAdapter,
      auth: options?.auth,
      responseType: options?.responseType,
      errors: options?.errors,
      middleware: options?.middleware,
      cors: options?.cors,
    });
  }
}

export function createAPIGatewayRouter<
  TDefaultAuth extends RawAuth = RawAuth,
  TDefaultKind extends RouteKind<TErrors> = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
>(
  options?: APIGatewayRouterOptions<TDefaultAuth, TDefaultKind, TErrors, TContentType>,
): APIGatewayRouter<TDefaultAuth, TDefaultKind, TErrors, TContentType> {
  return new APIGatewayRouter(options);
}

export const defineRoute: DefineRouteFn<RawAuth> = createDefineRoute<RawAuth>();
