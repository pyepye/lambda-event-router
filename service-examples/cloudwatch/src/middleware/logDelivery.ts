import { logger } from '@latcher/base';
import type { CloudWatchLogsMiddleware } from '@latcher/cloudwatch';

// Matcher middleware: runs once per delivery, before any route middleware, for every log group.
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
