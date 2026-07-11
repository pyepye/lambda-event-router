import { logger } from '@lambda-event-router/base';
import type { EventBridgeMiddleware } from '@lambda-event-router/eventbridge';

import type { TOrderPlaced } from '../utils/schemas.js';

// Route middleware for placed orders. Typed to the route's detail so it slots onto processOrder
// without widening it.
export const withOrderContext: EventBridgeMiddleware<TOrderPlaced> = async (request, next) => {
  logger.info({
    message: 'Order context loaded',
    orderRef: request.detail.orderRef,
    customerId: request.detail.customerId,
  });
  await next(request);
};
