import { defineRabbitMQRoute } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';

// Route filtered by queue name
export const queueRoute = defineRabbitMQRoute({
  filters: {
    eventSourceArns: [BROKER_ARN],
    queues: ['orders-queue'],
  },
}).handle(async ({ message, queue }) => {
  console.log(`Message from ${queue}: ${message.data}`);
});
