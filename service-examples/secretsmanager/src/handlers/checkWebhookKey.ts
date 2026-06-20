import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/secretsmanager';

import { readPendingToken } from '../utils/pendingToken.js';

// A signing key has no target to update and nothing to sign against until it is live, so setSecret
// and testSecret do the same readback. One route with a step list covers both. Registered before
// announceRotation, whose wildcard list also matches this secret.
export const checkWebhookKey = defineRoute({
  filters: {
    secretId: '*/webhooks/*',
    step: ['setSecret', 'testSecret'],
  },
}).handle(async (request) => {
  const pending = await readPendingToken(request.secretId, request.clientRequestToken);
  if (!pending) throw new Error(`No pending signing key for ${request.secretId}`);

  logger.info({ message: 'Webhook signing key checked', step: request.step, tokenLength: pending.length });
});
