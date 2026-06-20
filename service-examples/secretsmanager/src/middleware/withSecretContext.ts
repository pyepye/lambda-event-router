import { logger } from '@lambda-event-router/base';
import type { SecretsManagerMiddleware } from '@lambda-event-router/secretsmanager';

// Route middleware for the createSecret step. Every later line in the invocation carries the secret
// name, which the ARN in the event hides behind a random suffix.
export const withSecretContext: SecretsManagerMiddleware = async (request, next) => {
  logger.appendKeys({ secretName: request.secretName });

  return next(request);
};
