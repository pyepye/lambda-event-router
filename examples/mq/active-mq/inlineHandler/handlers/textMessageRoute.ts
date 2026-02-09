import { defineActiveMQRoute } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';

// Route filtered to text messages only
export const textMessageRoute = defineActiveMQRoute({
  filters: {
    eventSourceArns: [BROKER_ARN],
    messageTypes: ['jms/text-message'],
  },
}).handle(async ({ message, destination }) => {
  console.log(`Text message on ${destination}: ${message.data}`);
});
