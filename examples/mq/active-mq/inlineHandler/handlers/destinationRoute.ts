import { defineActiveMQRoute } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';

// Route filtered by destination (queue name)
export const destinationRoute = defineActiveMQRoute({
  filters: {
    eventSourceArns: [BROKER_ARN],
    destinations: ['orders-queue'],
  },
}).handle(async ({ message, destination }) => {
  console.log(`Message from ${destination}: ${message.data}`);
});
