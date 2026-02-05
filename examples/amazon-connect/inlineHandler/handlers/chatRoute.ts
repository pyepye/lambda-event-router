import { defineRoute } from '@lambda-event-router/amazon-connect';

import { INSTANCE_ARN } from '../constants.js';

export const chatRoute = defineRoute({
  filters: {
    channels: ['CHAT'],
    instanceArns: [INSTANCE_ARN],
  },
}).handle(async ({ contactData, parameters }) => {
  const customerName = contactData.Attributes.customerName;
  const chatTopic = parameters.topic;
  console.log(`Chat started by ${customerName} about ${chatTopic}`);

  return { message: `Hello ${customerName}, how can I help with ${chatTopic}?` };
});
