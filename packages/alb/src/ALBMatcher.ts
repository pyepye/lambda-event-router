import type { ALBEvent, ALBResult } from 'aws-lambda';

import type {
  CorsConfig,
  DefineRouteFn,
  ErrorFunctions,
  HtmlMatcherErrors,
  HTTPMatcherOptions,
  ResponseBody,
  ResponseKind,
  ResponseTypeOption,
} from '@latcher/http';
import { createDefineRoute, HTTPMatcher } from '@latcher/http';

import { albAdapter } from './albAdapter.js';
import type { HTTPMiddleware } from './types.js';

export interface ALBMatcherOptions<
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

export class ALBMatcher<
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
> extends HTTPMatcher<ALBEvent, ALBResult, undefined, undefined, TDefaultKind, TErrors, TContentType> {
  constructor(
    options?: ALBMatcherOptions<TDefaultKind, TErrors, TContentType> & HtmlMatcherErrors<NoInfer<TDefaultKind>>,
  ) {
    // The options already passed HtmlMatcherErrors, which TypeScript cannot resolve here for a generic kind
    super({
      adapter: albAdapter,
      responseType: options?.responseType,
      errors: options?.errors,
      middleware: options?.middleware,
      cors: options?.cors,
    } as HTTPMatcherOptions<ALBEvent, ALBResult, undefined, undefined, TDefaultKind, TErrors, TContentType> &
      HtmlMatcherErrors<TDefaultKind>);
  }
}

export function createALBMatcher<
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
>(
  options?: ALBMatcherOptions<TDefaultKind, TErrors, TContentType> & HtmlMatcherErrors<NoInfer<TDefaultKind>>,
): ALBMatcher<TDefaultKind, TErrors, TContentType> {
  return new ALBMatcher(options);
}

export const defineRoute: DefineRouteFn<undefined, undefined, 'json', ALBEvent> = createDefineRoute<
  undefined,
  undefined,
  ALBEvent
>();
