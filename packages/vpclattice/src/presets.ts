import type { AuthPreset } from '@lambda-event-router/http';

import type { VPCLatticeAuth, VPCLatticeIamAuth } from './auth.js';

export { noAuth } from '@lambda-event-router/http';

// Lattice names no caller for an unsigned request, so a request without auth is the missing case
export function iamAuth(): AuthPreset<VPCLatticeAuth, VPCLatticeIamAuth> {
  return {
    name: 'iamAuth',
    check: async (auth: VPCLatticeAuth) => {
      if (auth === undefined) return { success: false, reason: 'missing', message: 'Expected iam auth, got none' };
      return { success: true, auth };
    },
  };
}
