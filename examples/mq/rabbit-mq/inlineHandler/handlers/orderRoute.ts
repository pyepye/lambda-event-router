import { defineRabbitMQRoute, type RabbitMQFilterInput } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';
import { orderSchema } from '../orderSchemas.js';

// Route with Zod schema validation on decoded message body
export const orderRoute = defineRabbitMQRoute({
  filters: {
    eventSourceArn: BROKER_ARN,
    queue: 'orders-queue',
    contentType: 'application/json',
  },
  bodySchema: orderSchema,
}).handle(async ({ body }) => {
  // body is typed as z.infer<typeof orderSchema>
  console.log(`Order ${body.orderId} for customer ${body.customerId} - total: ${body.total}`);
});

// Match orders from retry queues using custom filter on queue name pattern
export const retryOrderRoute = defineRabbitMQRoute({
  filters: {
    eventSourceArn: BROKER_ARN,
    contentType: 'application/json',
    custom: ({ queue }: RabbitMQFilterInput) => {
      // Match messages from any retry/dead-letter queue
      const retrySuffix = '-retry';
      return queue.endsWith(retrySuffix);
    },
  },
  bodySchema: orderSchema,
}).handle(async ({ body }) => {
  console.log(`Retried order ${body.orderId} for customer ${body.customerId} - total: ${body.total}`);
});
