import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/secretsmanager';

import { MANAGED_SECRET_PATTERNS } from '../config.js';
import { readPendingToken } from '../utils/pendingToken.js';

// The setSecret step. These tokens are issued by the platform and read straight from Secrets
// Manager, so there is no external system to push the new value into. Reading the pending version
// back is all this step can usefully do.
export const announceRotation = defineRoute({
  filters: {
    secretId: MANAGED_SECRET_PATTERNS,
  },
}).handle(async (request) => {
  const pending = await readPendingToken(request.secretId, request.clientRequestToken);
  if (!pending) throw new Error(`No pending token to announce for ${request.secretId}`);

  logger.info({ message: 'Pending token announced', tokenLength: pending.length });
});
