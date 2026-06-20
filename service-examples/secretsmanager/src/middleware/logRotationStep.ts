import { logger } from '@lambda-event-router/base';
import type { SecretsManagerMiddleware } from '@lambda-event-router/secretsmanager';

// Router middleware: runs once per rotation event, before any route middleware, for every secret.
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
