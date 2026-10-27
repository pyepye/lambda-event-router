import type {
  AuthPreset,
  CorsConfig,
  DefineRouteFn,
  ErrorFunctions,
  HTTPMatcherOptions,
  HtmlMatcherErrors,
  ResponseBody,
  ResponseKind,
  ResponseTypeOption,
} from '@latcher/http';
import { HTTPMatcher, createDefineRoute } from '@latcher/http';

import { type APIGatewayEvent, type APIGatewayResult, apiGatewayAdapter } from './apiGatewayAdapter.js';
import type { APIGatewayAuth } from './auth.js';
import type { HTTPMiddleware } from './types.js';

type RawAuth = APIGatewayAuth;

export interface APIGatewayMatcherOptions<
  TDefaultAuth extends RawAuth = RawAuth,
  TDefaultKind extends ResponseKind = 'json',
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

export class APIGatewayMatcher<
  TDefaultAuth extends RawAuth = RawAuth,
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
> extends HTTPMatcher<APIGatewayEvent, APIGatewayResult, RawAuth, TDefaultAuth, TDefaultKind, TErrors, TContentType> {
  constructor(
    options?: APIGatewayMatcherOptions<TDefaultAuth, TDefaultKind, TErrors, TContentType> &
      HtmlMatcherErrors<NoInfer<TDefaultKind>>,
  ) {
    // The options already passed HtmlMatcherErrors, which TypeScript cannot resolve here for a generic kind
    super({
      adapter: apiGatewayAdapter,
      auth: options?.auth,
      responseType: options?.responseType,
      errors: options?.errors,
      middleware: options?.middleware,
      cors: options?.cors,
    } as HTTPMatcherOptions<
      APIGatewayEvent,
      APIGatewayResult,
      RawAuth,
      TDefaultAuth,
      TDefaultKind,
      TErrors,
      TContentType
    > &
      HtmlMatcherErrors<TDefaultKind>);
  }
}

export function createAPIGatewayMatcher<
  TDefaultAuth extends RawAuth = RawAuth,
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
>(
  options?: APIGatewayMatcherOptions<TDefaultAuth, TDefaultKind, TErrors, TContentType> &
    HtmlMatcherErrors<NoInfer<TDefaultKind>>,
): APIGatewayMatcher<TDefaultAuth, TDefaultKind, TErrors, TContentType> {
  return new APIGatewayMatcher(options);
}

export const defineRoute: DefineRouteFn<RawAuth, RawAuth, 'json', APIGatewayEvent> = createDefineRoute<
  RawAuth,
  RawAuth,
  APIGatewayEvent
>();
