import { logger } from '@lambda-event-router/base';
import type { CloudWatchLogsMiddleware } from '@lambda-event-router/cloudwatch';

// Router middleware: runs once per delivery, before any route middleware, for every log group.
export const logDelivery: CloudWatchLogsMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling log delivery',
    logGroup: request.logGroup,
    logStream: request.logStream,
    subscriptionFilters: request.subscriptionFilters,
    messageType: request.messageType,
    eventCount: request.logEvents.length,
  });
  await next(request);
};
