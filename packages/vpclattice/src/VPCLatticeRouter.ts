import type { ContentType, CorsConfig, HTTPErrorHandler, HTTPMiddleware } from '@lambda-event-router/http';
import { HTTPRouter } from '@lambda-event-router/http';

import { type VPCLatticeEvent, vpcLatticeAdapter } from './vpcLatticeAdapter.js';
import type { VPCLatticeResult } from './vpcLatticeV1Adapter.js';

export interface VPCLatticeRouterOptions {
  middleware?: HTTPMiddleware[];
  cors?: CorsConfig;
  contentType?: ContentType;
  onError?: HTTPErrorHandler;
}

export class VPCLatticeRouter extends HTTPRouter<VPCLatticeEvent, VPCLatticeResult> {
  constructor(options?: VPCLatticeRouterOptions) {
    super({
      adapter: vpcLatticeAdapter,
      middleware: options?.middleware,
      cors: options?.cors,
      contentType: options?.contentType,
      onError: options?.onError,
    });
  }
}

export function createVPCLatticeRouter(options?: VPCLatticeRouterOptions): VPCLatticeRouter {
  return new VPCLatticeRouter(options);
}
