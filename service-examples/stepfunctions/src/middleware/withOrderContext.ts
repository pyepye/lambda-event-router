import { logger } from '@lambda-event-router/base';
import type { StepFunctionsMiddleware } from '@lambda-event-router/stepfunctions';

import type { TReserveStock } from '../utils/schemas.js';

// Route middleware for a regular route, where the validated payload sits on `event`.
// Typed to the route's schema so it slots onto reserveStock without widening it.
export const withOrderContext: StepFunctionsMiddleware<unknown, TReserveStock> = async (request, next) => {
  logger.info({
    message: 'Order context resolved',
    orderId: request.event.orderId,
    sku: request.event.sku,
  });
  return next(request);
};
