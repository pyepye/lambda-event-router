import { defineRoute, NotFound } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { getOrder } from '../utils/dynamodb.js';
import { OrderSchema, type TOrder } from '../utils/schemas.js';

export const getOrderRoute = defineRoute({
  filters: {
    method: 'GET',
    path: '/orders/:id',
  },
  responseSchema: OrderSchema,
}).handle(async (request) => {
  const { id } = request.path;

  let order: TOrder;
  try {
    order = await getOrder(id);
  } catch {
    logger.info({ message: 'Order not found', orderId: id });
    throw NotFound(`Order ${id} not found`);
  }

  return order;
});
