import { defineRoute, NotFound, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { ORDER_LINES, ORDERS } from '../utils/warehouse.js';

// Two path params in one route, so the request carries both.
export const getOrderLine = defineRoute({
  filters: { method: 'GET', path: '/orders/:orderId/lines/:lineId' },
}).handle(async (request) => {
  const { orderId, lineId } = request.path;

  if (!ORDERS[orderId]) throw NotFound({ error: `Order ${orderId} does not exist` });

  const line = ORDER_LINES[lineId];
  if (!line) throw NotFound({ error: `Line ${lineId} is not on order ${orderId}` });

  logger.info({ message: 'Order line read', orderId, lineId });

  return Ok({ orderId, ...line });
});
