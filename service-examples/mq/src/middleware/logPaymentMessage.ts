import { logger } from '@latcher/base';
import type { RabbitMQMiddleware } from '@latcher/mq';

// Matcher middleware: runs once per message, before any route middleware, for every queue.
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
