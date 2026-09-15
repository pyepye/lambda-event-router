import type { ALBEvent, ALBResult } from 'aws-lambda';

import type {
  CorsConfig,
  DefineRouteFn,
  ErrorFunctions,
  HTTPRouterOptions,
  HtmlRouterErrors,
  ResponseBody,
  ResponseKind,
  ResponseTypeOption,
} from '@lambda-event-router/http';
import { createDefineRoute, HTTPRouter } from '@lambda-event-router/http';

import { albAdapter } from './albAdapter.js';
import type { HTTPMiddleware } from './types.js';

export interface ALBRouterOptions<
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
> {
  responseType?: ResponseTypeOption<TDefaultKind, TContentType>;
  errors?: TErrors & ErrorFunctions;
  middleware?: HTTPMiddleware<
    Record<string, string>,
    Record<string, string | undefined>,
    undefined,
    unknown,
    ResponseBody
  >[];
  cors?: CorsConfig;
}

export class ALBRouter<
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
> extends HTTPRouter<ALBEvent, ALBResult, undefined, undefined, TDefaultKind, TErrors, TContentType> {
  constructor(
    options?: ALBRouterOptions<TDefaultKind, TErrors, TContentType> & HtmlRouterErrors<NoInfer<TDefaultKind>>,
  ) {
    // The options already passed HtmlRouterErrors, which TypeScript cannot resolve here for a generic kind
    super({
      adapter: albAdapter,
      responseType: options?.responseType,
      errors: options?.errors,
      middleware: options?.middleware,
      cors: options?.cors,
    } as HTTPRouterOptions<ALBEvent, ALBResult, undefined, undefined, TDefaultKind, TErrors, TContentType> &
      HtmlRouterErrors<TDefaultKind>);
  }
}

export function createALBRouter<
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
>(
  options?: ALBRouterOptions<TDefaultKind, TErrors, TContentType> & HtmlRouterErrors<NoInfer<TDefaultKind>>,
): ALBRouter<TDefaultKind, TErrors, TContentType> {
  return new ALBRouter(options);
}

export const defineRoute: DefineRouteFn<undefined, undefined, 'json', ALBEvent> = createDefineRoute<
  undefined,
  undefined,
  ALBEvent
>();
