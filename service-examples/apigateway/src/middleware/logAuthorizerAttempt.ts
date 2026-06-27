import type { LambdaAuthorizerMiddleware } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

// Router middleware on the authorizer: runs for every authorizer event, whatever its type.
export const logAuthorizerAttempt: LambdaAuthorizerMiddleware = async (request, next) => {
  logger.info({
    message: 'Authorising request',
    authorizerType: request.type,
    method: request.method,
    resourceArn: request.resourceArn,
  });

  return next(request);
};
