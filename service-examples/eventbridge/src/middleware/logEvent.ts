import { logger } from '@lambda-event-router/base';
import type { EventBridgeMiddleware } from '@lambda-event-router/eventbridge';

// Router middleware: runs once per event, before any route middleware, for every route.
export const logEvent: EventBridgeMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling EventBridge event',
    eventId: request.id,
    source: request.source,
    detailType: request.detailType,
    account: request.account,
    region: request.region,
  });
  await next(request);
};
