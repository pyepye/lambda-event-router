import { defineRoute } from '@lambda-event-router/cloudwatch';

import { AUDIT_LOG_GROUP } from '../config.js';

// Audit records go to the SIEM, which is offline. This is the only route that fails inside the
// handler rather than on a missing route, so the middleware chain has already run when it throws.
// The messageType list takes control messages as well, because a reachability check is worth
// forwarding too.
export const forwardAuditToSiem = defineRoute({
  filters: {
    logGroup: AUDIT_LOG_GROUP,
    messageType: ['DATA_MESSAGE', 'CONTROL_MESSAGE'],
  },
}).handle(async (request) => {
  throw new Error(`SIEM endpoint unreachable for ${request.logGroup}`);
});
