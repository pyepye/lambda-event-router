import { defineRabbitMQRoute } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';

// Route matching all messages from the broker
export const allMessagesRoute = defineRabbitMQRoute({
  filters: {
    eventSourceArn: BROKER_ARN,
  },
}).handle(async ({ message, queue }) => {
  console.log(`Received message on queue ${queue}: ${message.data}`);
});
