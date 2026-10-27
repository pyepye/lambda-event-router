import { logger } from '@latcher/base';
import type { CloudWatchLogsMiddleware } from '@latcher/cloudwatch';

// Route middleware for the checkout error route: opens an incident before the handler escalates it.
export const withIncidentContext: CloudWatchLogsMiddleware = async (request, next) => {
  logger.info({
    message: 'Incident opened',
    incidentRef: `INC-${request.logEvents[0]?.id ?? 'unknown'}`,
    owner: request.owner,
  });
  await next(request);
};
