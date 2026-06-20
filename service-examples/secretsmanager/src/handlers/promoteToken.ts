import { DescribeSecretCommand, UpdateSecretVersionStageCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/secretsmanager';

import { MANAGED_SECRET_PATTERNS, secretsManagerClient } from '../config.js';

// The finishSecret step. Moving AWSCURRENT onto the pending version is what ends a rotation.
export const promoteToken = defineRoute({
  filters: {
    secretId: MANAGED_SECRET_PATTERNS,
  },
}).handle(async (request) => {
  const { VersionIdsToStages } = await secretsManagerClient.send(
    new DescribeSecretCommand({ SecretId: request.secretId }),
  );
  const currentVersionId = Object.entries(VersionIdsToStages ?? {}).find(([, stages]) =>
    stages.includes('AWSCURRENT'),
  )?.[0];

  if (currentVersionId === request.clientRequestToken) {
    logger.info({ message: 'Token already promoted' });
    return;
  }

  await secretsManagerClient.send(
    new UpdateSecretVersionStageCommand({
      SecretId: request.secretId,
      VersionStage: 'AWSCURRENT',
      MoveToVersionId: request.clientRequestToken,
      RemoveFromVersionId: currentVersionId,
    }),
  );

  logger.info({ message: 'Token promoted to AWSCURRENT', previousVersionId: currentVersionId });
});
