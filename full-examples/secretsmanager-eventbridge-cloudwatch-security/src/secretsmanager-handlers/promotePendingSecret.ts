import { DescribeSecretCommand, UpdateSecretVersionStageCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/secretsmanager';

import { SECRET_ARN, secretsManager } from '../config.js';

export const promotePendingSecret = defineRoute({
  filters: {
    secretId: SECRET_ARN,
  },
}).handle(async (request) => {
  const { VersionIdsToStages } = await secretsManager.send(new DescribeSecretCommand({ SecretId: request.secretId }));
  const currentVersionId = Object.entries(VersionIdsToStages ?? {}).find(([, stages]) =>
    stages.includes('AWSCURRENT'),
  )?.[0];

  if (currentVersionId === request.clientRequestToken) {
    logger.info({ message: 'Secret already promoted' });
    return;
  }

  await secretsManager.send(
    new UpdateSecretVersionStageCommand({
      SecretId: request.secretId,
      VersionStage: 'AWSCURRENT',
      MoveToVersionId: request.clientRequestToken,
      RemoveFromVersionId: currentVersionId,
    }),
  );

  logger.info({ message: 'Secret promoted to AWSCURRENT', previousVersionId: currentVersionId });
});
