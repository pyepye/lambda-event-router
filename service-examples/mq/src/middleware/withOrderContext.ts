import { logger } from '@lambda-event-router/base';
import type { ActiveMQMiddleware } from '@lambda-event-router/mq';

import type { TOrder } from '../utils/schemas.js';

// Route middleware for the escalation route. The second type parameter pins it to a text message, so
// it slots onto a text-only route without widening that route's handler to the union of both types.
export const withOrderContext: ActiveMQMiddleware<TOrder, 'jms/text-message'> = async (request, next) => {
  logger.info({ message: 'Urgent order received', orderId: request.body.orderId });
  await next(request);
};
