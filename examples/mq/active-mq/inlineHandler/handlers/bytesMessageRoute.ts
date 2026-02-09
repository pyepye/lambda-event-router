import { defineActiveMQRoute } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';

// Route filtered to bytes messages only
export const bytesMessageRoute = defineActiveMQRoute({
  filters: {
    eventSourceArns: [BROKER_ARN],
    messageTypes: ['jms/bytes-message'],
  },
}).handle(async ({ message, destination }) => {
  console.log(`Bytes message on ${destination}: ${message.data}`);
});
