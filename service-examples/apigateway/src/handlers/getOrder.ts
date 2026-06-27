import { defineRoute, NotFound, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { withOrderContext } from '../middleware/withOrderContext.js';
import { OrderQuerySchema } from '../utils/schemas.js';
import { ORDERS } from '../utils/warehouse.js';

// A REST API request, so the event carries the multi-value forms of the headers and the query, and
// a REQUEST authorizer has already put its principal and context on `auth`.
export const getOrder = defineRoute({
  filters: { method: 'GET', path: '/orders/:orderId' },
  querySchema: OrderQuerySchema,
  middleware: [withOrderContext],
}).handle(async (request) => {
  const order = ORDERS[request.path.orderId];
  if (!order) throw NotFound({ error: `Order ${request.path.orderId} does not exist` });

  logger.info({
    message: 'Order read',
    orderId: order.orderId,
    page: request.query.page,
    include: request.query.include,
    tags: request.multiValueQuery.tag,
    principalId: request.auth?.principalId,
    authorizerContext: request.auth?.context,
  });

  return Ok(order, { 'x-order-version': '3' });
});
