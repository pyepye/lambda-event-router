import type { VPCLatticeIdentity } from './vpcLatticeV2Adapter.js';

export interface VPCLatticeIamAuth {
  type: 'iam';
  principalId: string;
  iam: VPCLatticeIdentity;
}

export type VPCLatticeAuth = VPCLatticeIamAuth | undefined;
