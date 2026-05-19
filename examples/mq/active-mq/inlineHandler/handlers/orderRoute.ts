import { type ActiveMQFilterInput, defineActiveMQRoute } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';
import { orderSchema } from '../orderSchemas.js';

// Route with Zod schema validation on decoded message body
export const orderRoute = defineActiveMQRoute({
  filters: {
    eventSourceArn: BROKER_ARN,
    destination: 'orders-queue',
    messageType: 'jms/text-message',
  },
  bodySchema: orderSchema,
}).handle(async ({ body }) => {
  // body is typed as z.infer<typeof orderSchema>
  console.log(`Order ${body.orderId} for customer ${body.customerId} - total: ${body.total}`);
});

// Match priority orders from specific destination pattern using custom filter
export const priorityOrderRoute = defineActiveMQRoute({
  filters: {
    eventSourceArn: BROKER_ARN,
    messageType: 'jms/text-message',
    custom: ({ destination }: ActiveMQFilterInput) => {
      // Match messages from any priority queue destination
      const priorityPrefix = 'priority-';
      return destination.startsWith(priorityPrefix);
    },
  },
  bodySchema: orderSchema,
}).handle(async ({ body }) => {
  console.log(`Priority order ${body.orderId} for customer ${body.customerId} - total: ${body.total}`);
});
