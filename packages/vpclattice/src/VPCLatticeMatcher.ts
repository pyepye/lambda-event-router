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

import type { VPCLatticeAuth } from './auth.js';
import type { HTTPMiddleware } from './types.js';
import { type VPCLatticeEvent, vpcLatticeAdapter } from './vpcLatticeAdapter.js';
import type { VPCLatticeResult } from './vpcLatticeV1Adapter.js';

type RawAuth = VPCLatticeAuth;

export interface VPCLatticeMatcherOptions<
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

export class VPCLatticeMatcher<
  TDefaultAuth extends RawAuth = RawAuth,
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
> extends HTTPMatcher<VPCLatticeEvent, VPCLatticeResult, RawAuth, TDefaultAuth, TDefaultKind, TErrors, TContentType> {
  constructor(
    options?: VPCLatticeMatcherOptions<TDefaultAuth, TDefaultKind, TErrors, TContentType> &
      HtmlMatcherErrors<NoInfer<TDefaultKind>>,
  ) {
    // The options already passed HtmlMatcherErrors, which TypeScript cannot resolve here for a generic kind
    super({
      adapter: vpcLatticeAdapter,
      auth: options?.auth,
      responseType: options?.responseType,
      errors: options?.errors,
      middleware: options?.middleware,
      cors: options?.cors,
    } as HTTPMatcherOptions<
      VPCLatticeEvent,
      VPCLatticeResult,
      RawAuth,
      TDefaultAuth,
      TDefaultKind,
      TErrors,
      TContentType
    > &
      HtmlMatcherErrors<TDefaultKind>);
  }
}

export function createVPCLatticeMatcher<
  TDefaultAuth extends RawAuth = RawAuth,
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
>(
  options?: VPCLatticeMatcherOptions<TDefaultAuth, TDefaultKind, TErrors, TContentType> &
    HtmlMatcherErrors<NoInfer<TDefaultKind>>,
): VPCLatticeMatcher<TDefaultAuth, TDefaultKind, TErrors, TContentType> {
  return new VPCLatticeMatcher(options);
}

export const defineRoute: DefineRouteFn<RawAuth, RawAuth, 'json', VPCLatticeEvent> = createDefineRoute<
  RawAuth,
  RawAuth,
  VPCLatticeEvent
>();
