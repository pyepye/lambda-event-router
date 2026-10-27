import { logger } from '@latcher/base';
import type { SecretsManagerMiddleware } from '@latcher/secretsmanager';

// Matcher middleware: runs once per rotation event, before any route middleware, for every secret.
export const logRotationStep: SecretsManagerMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling rotation step',
    step: request.step,
    secretId: request.secretId,
    clientRequestToken: request.clientRequestToken,
    rotationToken: request.rotationToken,
  });

  return next(request);
};
