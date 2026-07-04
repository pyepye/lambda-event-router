import type { AppSyncAuthorizerMiddleware } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

// Router middleware: runs for every token the API is asked to authorise.
export const logAuthorizationAttempt: AppSyncAuthorizerMiddleware = async (request, next) => {
  logger.info({
    message: 'Authorising request',
    token: request.authorizationToken,
    operationName: request.operationName,
  });

  return next(request);
};
