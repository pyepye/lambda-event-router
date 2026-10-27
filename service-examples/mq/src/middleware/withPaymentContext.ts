import { logger } from '@latcher/base';
import type { RabbitMQMiddleware } from '@latcher/mq';

import type { TPayment } from '../utils/schemas.js';

// Route middleware for the high value route, typed to that route's body so the handler keeps its
// payment type.
export const withPaymentContext: RabbitMQMiddleware<TPayment> = async (request, next) => {
  logger.info({
    message: 'High value payment received',
    paymentId: request.body.paymentId,
    priority: request.record.basicProperties.priority,
  });
  await next(request);
};
