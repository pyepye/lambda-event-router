import { defineRabbitMQRoute } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';
import { orderSchema } from '../orderSchemas.js';

// Route with Zod schema validation on decoded message body
export const orderRoute = defineRabbitMQRoute({
  filters: {
    eventSourceArns: [BROKER_ARN],
    queues: ['orders-queue'],
    contentTypes: ['application/json'],
  },
  bodySchema: orderSchema,
}).handle(async ({ body }) => {
  // body is typed as z.infer<typeof orderSchema>
  console.log(`Order ${body.orderId} for customer ${body.customerId} - total: ${body.total}`);
});
