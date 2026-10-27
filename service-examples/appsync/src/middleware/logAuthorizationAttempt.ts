import type { AppSyncAuthorizerMiddleware } from '@latcher/appsync';
import { logger } from '@latcher/base';

// Matcher middleware: runs for every token the API is asked to authorise.
export const logAuthorizationAttempt: AppSyncAuthorizerMiddleware = async (request, next) => {
  logger.info({
    message: 'Authorising request',
    token: request.authorizationToken,
    operationName: request.operationName,
  });

  return next(request);
};
