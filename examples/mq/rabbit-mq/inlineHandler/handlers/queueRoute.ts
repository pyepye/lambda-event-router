import { defineRabbitMQRoute } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';

// Route filtered by queue name
export const queueRoute = defineRabbitMQRoute({
  filters: {
    eventSourceArn: BROKER_ARN,
    queue: 'orders-queue',
  },
}).handle(async ({ message, queue }) => {
  console.log(`Message from ${queue}: ${message.data}`);
});
