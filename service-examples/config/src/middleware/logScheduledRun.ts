import { logger } from '@latcher/base';
import type { ConfigScheduledMiddleware } from '@latcher/config';

// Matcher middleware: runs once per periodic evaluation, before any route middleware. It logs the raw
// event as Config delivered it, so the log can be compared with the matcher's types.
export const logScheduledRun: ConfigScheduledMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling scheduled evaluation',
    configRuleName: request.configRuleName,
    accountId: request.accountId,
    event: request.event,
  });
  return next(request);
};
