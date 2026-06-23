import { logger } from '@lambda-event-router/base';
import type { RabbitMQMiddleware } from '@lambda-event-router/mq';

// Router middleware: runs once per message, before any route middleware, for every queue.
export const logPaymentMessage: RabbitMQMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling RabbitMQ message',
    queue: request.queue,
    virtualHost: request.virtualHost,
    contentType: request.record.basicProperties.contentType,
    redelivered: request.record.redelivered,
  });
  await next(request);
};
