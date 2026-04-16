import { defineActiveMQRoute } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';

// Route matching all messages from the broker
export const allMessagesRoute = defineActiveMQRoute({
  filters: {
    eventSourceArn: BROKER_ARN,
  },
}).handle(async ({ message, destination }) => {
  console.log(`Received message on ${destination}: ${message.data}`);
});
