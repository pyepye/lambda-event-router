import type { FinalizedHTTPResponse, HTTPAdapter, NormalizedHTTPEvent } from '@latcher/http';

import type { VPCLatticeAuth } from './auth.js';
import { type VPCLatticeEventV1, type VPCLatticeResult, vpcLatticeV1Adapter } from './vpcLatticeV1Adapter.js';
import { type VPCLatticeEventV2, vpcLatticeV2Adapter } from './vpcLatticeV2Adapter.js';

export type VPCLatticeEvent = VPCLatticeEventV1 | VPCLatticeEventV2;

function isV2Event(event: VPCLatticeEvent): event is VPCLatticeEventV2 {
  return 'version' in event && event.version === '2.0';
}

export const vpcLatticeAdapter: HTTPAdapter<VPCLatticeEvent, VPCLatticeResult, VPCLatticeAuth> = {
  canHandleEvent(event: unknown): event is VPCLatticeEvent {
    return vpcLatticeV2Adapter.canHandleEvent(event) || vpcLatticeV1Adapter.canHandleEvent(event);
  },

  normalize(event: VPCLatticeEvent): NormalizedHTTPEvent<VPCLatticeAuth> {
    if (isV2Event(event)) {
      return vpcLatticeV2Adapter.normalize(event);
    }
    return vpcLatticeV1Adapter.normalize(event);
  },

  buildResult(response: FinalizedHTTPResponse, event: VPCLatticeEvent): VPCLatticeResult {
    if (isV2Event(event)) {
      return vpcLatticeV2Adapter.buildResult(response, event);
    }
    return vpcLatticeV1Adapter.buildResult(response, event);
  },
};
