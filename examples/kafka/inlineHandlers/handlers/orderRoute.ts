import { defineRoute } from '@lambda-event-router/kafka';
import { z } from 'zod';

import { ORDERS_TOPIC } from '../constants.js';

const OrderValueSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  total: z.number(),
  status: z.enum(['CREATED', 'CONFIRMED', 'SHIPPED', 'DELIVERED']),
});

export const orderRoute = defineRoute({
  filters: {
    topic: ORDERS_TOPIC,
  },
  valueSchema: OrderValueSchema,
}).handle(async (request) => {
  const { orderId, customerId, total, status } = request.value;
  console.log(`Processing order ${orderId} for customer ${customerId}: ${status} ($${total})`);
});
