import { randomUUID } from 'node:crypto';

import { Created, defineRoute } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { customerAuth } from '../utils/auth.js';
import { insertOrder } from '../utils/dynamodb.js';
import { OrderRequestSchema, OrderSchema } from '../utils/schemas.js';

export const createOrder = defineRoute({
  filters: {
    method: 'POST',
    path: '/orders',
  },
  auth: customerAuth,
  bodySchema: OrderRequestSchema,
  responseSchema: OrderSchema,
}).handle(async (request) => {
  const orderId = randomUUID();
  const { items } = request.body;
  const { customerId } = request.auth.context;

  const order = await insertOrder(orderId, items);

  logger.info({ message: 'Order created', orderId, customerId, lineCount: items.length });

  return Created(order);
});
