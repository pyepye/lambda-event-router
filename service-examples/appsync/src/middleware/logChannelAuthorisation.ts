import type { AppSyncEventsAuthorizerMiddleware } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

// Router middleware: runs for every connect, publish and subscribe the Event API asks about.
export const logChannelAuthorisation: AppSyncEventsAuthorizerMiddleware = async (request, next) => {
  logger.info({
    message: 'Authorising channel request',
    token: request.authorizationToken,
    operation: request.operation,
    channelPath: request.channelPath,
  });

  return next(request);
};
