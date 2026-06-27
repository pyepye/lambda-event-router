import type { HTTPMiddleware } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import type { TOrderQuery } from '../utils/schemas.js';

// Route middleware on GET /orders/:orderId: names the principal the REQUEST authorizer allowed. The
// query type is named because the route's schema coerces `page` to a number.
export const withOrderContext: HTTPMiddleware<{ orderId: string }, TOrderQuery> = async (request, next) => {
  logger.info({
    message: 'Order read authorised',
    orderId: request.path.orderId,
    principalId: request.auth?.principalId,
  });

  return next(request);
};
