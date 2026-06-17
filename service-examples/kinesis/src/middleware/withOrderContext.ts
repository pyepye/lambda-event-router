import { logger } from '@lambda-event-router/base';
import type { KinesisMiddleware } from '@lambda-event-router/kinesis';

import type { TOrder } from '../utils/schemas.js';

// Route middleware for the escalation route. Typed to the route's data, so it reads the order fields
// without widening the route.
export const withOrderContext: KinesisMiddleware<TOrder> = async (request, next) => {
  logger.info({
    message: 'Order escalated for review',
    orderId: request.data.orderId,
    total: request.data.total,
  });
  await next(request);
};
