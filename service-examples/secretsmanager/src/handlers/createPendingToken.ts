import { GetRandomPasswordCommand, PutSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/secretsmanager';

import { PAYMENTS_TOKEN_ARN, secretsManagerClient } from '../config.js';
import { withSecretContext } from '../middleware/withSecretContext.js';
import { readPendingToken } from '../utils/pendingToken.js';
import { TOKEN_LENGTH } from '../utils/secrets.js';

// The createSecret step for every managed secret. The filter is one list holding an ARN, a regex
// and a wildcard, which is how the three matcher types combine. The wildcard ends at the secret
// name, so it only matches because the router tests the name as well as the ARN.
export const createPendingToken = defineRoute({
  filters: {
    secretId: [PAYMENTS_TOKEN_ARN, /webhooks\/signing-key/, '*/index-key'],
  },
  middleware: [withSecretContext],
}).handle(async (request) => {
  // Secrets Manager retries a whole rotation after a failure, so this step has to be safe to run
  // twice against the same clientRequestToken.
  const existing = await readPendingToken(request.secretId, request.clientRequestToken);
  if (existing) {
    logger.info({ message: 'Pending token already created', tokenLength: existing.length });
    return;
  }

  const { RandomPassword } = await secretsManagerClient.send(
    new GetRandomPasswordCommand({ PasswordLength: TOKEN_LENGTH, ExcludePunctuation: true }),
  );
  if (!RandomPassword) throw new Error(`Secrets Manager returned no password for ${request.secretId}`);

  await secretsManagerClient.send(
    new PutSecretValueCommand({
      SecretId: request.secretId,
      ClientRequestToken: request.clientRequestToken,
      SecretString: RandomPassword,
      VersionStages: ['AWSPENDING'],
    }),
  );

  logger.info({ message: 'Pending token created', tokenLength: RandomPassword.length });
});
