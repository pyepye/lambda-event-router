import { randomUUID } from 'node:crypto';

import { Created, defineRoute } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { createOrder } from '../utils/dynamodb.js';
import { OrderRequestSchema, OrderSchema } from '../utils/schemas.js';

export const createOrderRoute = defineRoute({
  filters: {
    method: 'POST',
    path: '/orders',
  },
  bodySchema: OrderRequestSchema,
  responseSchema: OrderSchema,
}).handle(async (request) => {
  const orderId = randomUUID();
  const { items } = request.body;

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const order = await createOrder(orderId, items);

  logger.info({ message: 'Order created', orderId, lineCount: items.length });

  return Created(order);
});
