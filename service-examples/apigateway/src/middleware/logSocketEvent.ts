import type { WebSocketMiddleware } from '@latcher/apigateway';
import { logger } from '@latcher/base';

// Matcher middleware on the WebSocket matcher: runs for connects, messages and disconnects.
export const logSocketEvent: WebSocketMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling WebSocket event',
    eventType: request.eventType,
    routeKey: request.routeKey,
    connectionId: request.connectionId,
  });

  return next(request);
};
