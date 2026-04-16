import { defineActiveMQRoute } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';

// Route filtered by destination (queue name)
export const destinationRoute = defineActiveMQRoute({
  filters: {
    eventSourceArn: BROKER_ARN,
    destination: 'orders-queue',
  },
}).handle(async ({ message, destination }) => {
  console.log(`Message from ${destination}: ${message.data}`);
});
