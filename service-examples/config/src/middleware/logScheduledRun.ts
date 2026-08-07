import { logger } from '@lambda-event-router/base';
import type { ConfigScheduledMiddleware } from '@lambda-event-router/config';

// Router middleware: runs once per periodic evaluation, before any route middleware. It logs the raw
// event as Config delivered it, so the log can be compared with the router's types.
export const logScheduledRun: ConfigScheduledMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling scheduled evaluation',
    configRuleName: request.configRuleName,
    accountId: request.accountId,
    event: request.event,
  });
  return next(request);
};
