import { DescribeSecretCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '@lambda-event-router/base';
import { defineRoute, type SecretsManagerFilterInput } from '@lambda-event-router/secretsmanager';
import { secretsManagerClient } from '../config.js';
import { ROTATION_PAUSED_TAG } from '../utils/secrets.js';

// The pause flag is a tag on the secret, so the filter has to read it from Secrets Manager. A
// custom filter may return a promise, which is what makes that possible.
async function isRotationPaused({ secretId }: SecretsManagerFilterInput): Promise<boolean> {
  const { Tags } = await secretsManagerClient.send(new DescribeSecretCommand({ SecretId: secretId }));

  return Tags?.some((tag) => tag.Key === ROTATION_PAUSED_TAG && tag.Value === 'true') ?? false;
}

// Registered first and with no step filter, so a paused secret never reaches the rotation routes on
// any of the four steps.
export const holdPausedRotation = defineRoute({
  filters: {
    custom: isRotationPaused,
  },
}).handle(async (request) => {
  logger.info({
    message: 'Rotation held, secret is tagged paused',
    secretName: request.secretName,
    step: request.step,
  });
});
