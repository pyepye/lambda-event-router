import { HTTPRouter } from '@lambda-event-router/http';
import { type VPCLatticeEvent, vpcLatticeAdapter } from './vpcLatticeAdapter.js';
import type { VPCLatticeResult } from './vpcLatticeV1Adapter.js';

export class VPCLatticeRouter extends HTTPRouter<VPCLatticeEvent, VPCLatticeResult> {
  constructor() {
    super(vpcLatticeAdapter);
  }
}

export function createVPCLatticeRouter(): VPCLatticeRouter {
  return new VPCLatticeRouter();
}
