import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/secretsmanager';

import { HIGH_RISK_SECRETS, PAYMENTS_TOKEN_ARN } from '../config.js';
import { readPendingToken } from '../utils/pendingToken.js';
import { TOKEN_LENGTH } from '../utils/secrets.js';

// The testSecret step for the payments token. Both filters have to pass: the exact ARN CDK injects,
// and a custom filter over the high risk list, which is held in code rather than in the secret name.
export const verifyPaymentsToken = defineRoute({
  filters: {
    secretId: PAYMENTS_TOKEN_ARN,
    custom: ({ secretName }) => HIGH_RISK_SECRETS.includes(secretName),
  },
}).handle(async (request) => {
  const pending = await readPendingToken(request.secretId, request.clientRequestToken);
  if (!pending) throw new Error(`No pending token to verify for ${request.secretId}`);
  if (pending.length !== TOKEN_LENGTH) {
    throw new Error(`Pending token for ${request.secretId} is ${pending.length} characters`);
  }

  logger.info({ message: 'Pending payments token verified', tokenLength: pending.length });
});
