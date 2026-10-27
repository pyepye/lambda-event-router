import type { LambdaAuthorizerMiddleware } from '@latcher/apigateway';
import { logger } from '@latcher/base';

// Matcher middleware on the authorizer: runs for every authorizer event, whatever its type.
export const logAuthorizerAttempt: LambdaAuthorizerMiddleware = async (request, next) => {
  logger.info({
    message: 'Authorising request',
    authorizerType: request.type,
    method: request.method,
    resourceArn: request.resourceArn,
  });

  return next(request);
};
