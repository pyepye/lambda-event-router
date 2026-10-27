import { defineRoute, NotFound } from '@latcher/apigateway';

import { findOrder } from '../utils/dynamodb.js';
import { OrderSchema } from '../utils/schemas.js';

export const getOrder = defineRoute({
  filters: {
    method: 'GET',
    path: '/orders/:id',
  },
  responseSchema: OrderSchema,
}).handle(async (request) => {
  const { id } = request.path;

  const order = await findOrder(id);
  if (!order) throw NotFound(`Order ${id} not found`);

  return order;
});
