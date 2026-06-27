import type { WebSocketMiddleware } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

// Router middleware on the WebSocket router: runs for connects, messages and disconnects.
export const logSocketEvent: WebSocketMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling WebSocket event',
    eventType: request.eventType,
    routeKey: request.routeKey,
    connectionId: request.connectionId,
  });

  return next(request);
};
