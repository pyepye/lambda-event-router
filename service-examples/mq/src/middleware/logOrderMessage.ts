import { logger } from '@lambda-event-router/base';
import type { ActiveMQMiddleware } from '@lambda-event-router/mq';

// Router middleware: runs once per message, before any route middleware, for every destination.
// `redelivered` is true from the second delivery of a message onwards, which is how a retry shows.
export const logOrderMessage: ActiveMQMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling ActiveMQ message',
    messageID: request.record.messageID,
    destination: request.destination,
    messageType: request.messageType,
    redelivered: request.record.redelivered,
  });
  await next(request);
};
