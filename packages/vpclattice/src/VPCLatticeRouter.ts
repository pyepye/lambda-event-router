import type {
  AuthPreset,
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

import type { VPCLatticeAuth } from './auth.js';
import type { HTTPMiddleware } from './types.js';
import { type VPCLatticeEvent, vpcLatticeAdapter } from './vpcLatticeAdapter.js';
import type { VPCLatticeResult } from './vpcLatticeV1Adapter.js';

type RawAuth = VPCLatticeAuth;

export interface VPCLatticeRouterOptions<
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

export class VPCLatticeRouter<
  TDefaultAuth extends RawAuth = RawAuth,
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
> extends HTTPRouter<VPCLatticeEvent, VPCLatticeResult, RawAuth, TDefaultAuth, TDefaultKind, TErrors, TContentType> {
  constructor(
    options?: VPCLatticeRouterOptions<TDefaultAuth, TDefaultKind, TErrors, TContentType> &
      HtmlRouterErrors<NoInfer<TDefaultKind>>,
  ) {
    // The options already passed HtmlRouterErrors, which TypeScript cannot resolve here for a generic kind
    super({
      adapter: vpcLatticeAdapter,
      auth: options?.auth,
      responseType: options?.responseType,
      errors: options?.errors,
      middleware: options?.middleware,
      cors: options?.cors,
    } as HTTPRouterOptions<
      VPCLatticeEvent,
      VPCLatticeResult,
      RawAuth,
      TDefaultAuth,
      TDefaultKind,
      TErrors,
      TContentType
    > &
      HtmlRouterErrors<TDefaultKind>);
  }
}

export function createVPCLatticeRouter<
  TDefaultAuth extends RawAuth = RawAuth,
  TDefaultKind extends ResponseKind = 'json',
  TErrors extends ErrorFunctions = Record<never, never>,
  TContentType extends string = string,
>(
  options?: VPCLatticeRouterOptions<TDefaultAuth, TDefaultKind, TErrors, TContentType> &
    HtmlRouterErrors<NoInfer<TDefaultKind>>,
): VPCLatticeRouter<TDefaultAuth, TDefaultKind, TErrors, TContentType> {
  return new VPCLatticeRouter(options);
}

export const defineRoute: DefineRouteFn<RawAuth, RawAuth, 'json', VPCLatticeEvent> = createDefineRoute<
  RawAuth,
  RawAuth,
  VPCLatticeEvent
>();
