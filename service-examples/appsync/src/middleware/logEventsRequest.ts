import type { AppSyncEventsMiddleware } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

// Router middleware: runs once per publish or subscribe, whatever the namespace.
export const logEventsRequest: AppSyncEventsMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling events request',
    operation: request.operation,
    channelPath: request.channelPath,
    channelNamespace: request.channelNamespace,
    eventCount: request.events.length,
  });

  return next(request);
};
