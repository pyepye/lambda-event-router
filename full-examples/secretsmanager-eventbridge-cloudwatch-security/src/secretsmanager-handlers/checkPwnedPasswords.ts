import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/secretsmanager';

import { SECRET_ARN } from '../config.js';
import { readPendingSecret } from '../utils/pendingSecret.js';
import { publishSecurityIssue } from '../utils/publishSecurityIssue.js';
import { countBreaches } from '../utils/pwnedPasswords.js';

export const checkPwnedPasswords = defineRoute({
  filters: {
    secretId: SECRET_ARN,
  },
}).handle(async (request) => {
  const pending = await readPendingSecret(request.secretId, request.clientRequestToken);
  if (!pending) throw new Error(`No pending secret to check for ${request.secretId}`);

  const breachCount = await countBreaches(pending);

  if (breachCount > 0) {
    logger.error({ message: 'Pending secret found in a breach', secretId: request.secretId, breachCount });
    await publishSecurityIssue(1);
    throw new Error(`Pending secret for ${request.secretId} is in ${breachCount} breaches`);
  }

  logger.info({ message: 'Pending secret not found in any breach', secretId: request.secretId });
});
