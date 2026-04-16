import { defineRabbitMQRoute } from '@lambda-event-router/mq';

import { BROKER_ARN } from '../constants.js';

// Route filtered by content type from basicProperties
export const contentTypeRoute = defineRabbitMQRoute({
  filters: {
    eventSourceArn: BROKER_ARN,
    contentType: 'application/json',
  },
}).handle(async ({ message, queue }) => {
  console.log(`JSON message from ${queue}: ${message.data}`);
});
