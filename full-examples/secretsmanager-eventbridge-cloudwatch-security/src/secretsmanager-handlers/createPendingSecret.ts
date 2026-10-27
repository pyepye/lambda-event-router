import { GetRandomPasswordCommand, PutSecretValueCommand } from '@aws-sdk/client-secrets-manager';

import { logger } from '@latcher/base';
import { defineRoute } from '@latcher/secretsmanager';

import { SECRET_ARN, secretsManager } from '../config.js';
import { readPendingSecret } from '../utils/pendingSecret.js';

const SECRET_LENGTH = 32;

export const createPendingSecret = defineRoute({
  filters: {
    secretId: SECRET_ARN,
  },
}).handle(async (request) => {
  // Secrets Manager replays a whole rotation after a failure, so this step must be safe to run twice.
  const existing = await readPendingSecret(request.secretId, request.clientRequestToken);
  if (existing) {
    logger.info({ message: 'Pending secret already created' });
    return;
  }

  const { RandomPassword } = await secretsManager.send(
    new GetRandomPasswordCommand({ PasswordLength: SECRET_LENGTH, ExcludePunctuation: true }),
  );
  if (!RandomPassword) throw new Error(`Secrets Manager returned no password for ${request.secretId}`);

  await secretsManager.send(
    new PutSecretValueCommand({
      SecretId: request.secretId,
      ClientRequestToken: request.clientRequestToken,
      SecretString: RandomPassword,
      VersionStages: ['AWSPENDING'],
    }),
  );

  logger.info({ message: 'Pending secret created' });
});
