import { logger } from '@lambda-event-router/base';
import type { KafkaMiddleware } from '@lambda-event-router/kafka';

import type { TOrder } from '../utils/schemas.js';

// Route middleware for the order route. Typed to the route's value so it slots onto processOrder
// without widening it.
export const withOrderContext: KafkaMiddleware<TOrder> = async (request, next) => {
  logger.info({
    message: 'Order context resolved',
    orderId: request.value.orderId,
    customerId: request.value.customerId,
  });
  await next(request);
};
