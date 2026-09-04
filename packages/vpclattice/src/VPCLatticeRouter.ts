import type { AuthPreset, CorsConfig, DefineRouteFn } from '@lambda-event-router/http';
import { createDefineRoute, HTTPRouter } from '@lambda-event-router/http';

import type { VPCLatticeAuth } from './auth.js';
import type { HTTPMiddleware } from './types.js';
import { type VPCLatticeEvent, vpcLatticeAdapter } from './vpcLatticeAdapter.js';
import type { VPCLatticeResult } from './vpcLatticeV1Adapter.js';

type RawAuth = VPCLatticeAuth;

export interface VPCLatticeRouterOptions<TDefaultAuth extends RawAuth = RawAuth> {
  auth?: AuthPreset<RawAuth, TDefaultAuth>;
  middleware?: HTTPMiddleware[];
  cors?: CorsConfig;
}

export class VPCLatticeRouter<TDefaultAuth extends RawAuth = RawAuth> extends HTTPRouter<
  VPCLatticeEvent,
  VPCLatticeResult,
  RawAuth,
  TDefaultAuth
> {
  constructor(options?: VPCLatticeRouterOptions<TDefaultAuth>) {
    super({ adapter: vpcLatticeAdapter, auth: options?.auth, middleware: options?.middleware, cors: options?.cors });
  }
}

export function createVPCLatticeRouter<TDefaultAuth extends RawAuth = RawAuth>(
  options?: VPCLatticeRouterOptions<TDefaultAuth>,
): VPCLatticeRouter<TDefaultAuth> {
  return new VPCLatticeRouter(options);
}

export const defineRoute: DefineRouteFn<RawAuth> = createDefineRoute<RawAuth>();
