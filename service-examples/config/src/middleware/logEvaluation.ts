import { logger } from '@latcher/base';
import type { ConfigMiddleware } from '@latcher/config';

// Matcher middleware: runs once per change-triggered evaluation, before any route middleware. It logs
// the raw event as Config delivered it, so the log can be compared with the matcher's types.
export const logEvaluation: ConfigMiddleware = async (request, next) => {
  const resource = request.configurationItem ?? request.configurationItemSummary;
  logger.info({
    message: 'Handling configuration change',
    configRuleName: request.configRuleName,
    resourceType: resource.resourceType,
    resourceId: resource.resourceId,
    configurationItemStatus: resource.configurationItemStatus,
    event: request.event,
  });
  return next(request);
};
