import { defineRoute } from '@lambda-event-router/connect';

import { INSTANCE_ARN } from '../constants.js';

export const voiceInboundRoute = defineRoute({
  filters: {
    channels: ['VOICE'],
    initiationMethods: ['INBOUND'],
    instanceArns: [INSTANCE_ARN],
  },
}).handle(async ({ contactData }) => {
  const customerNumber = contactData.CustomerEndpoint?.Address;
  const systemNumber = contactData.SystemEndpoint?.Address;
  console.log(`Inbound voice call from ${customerNumber} to ${systemNumber}`);

  return { greeting: 'Welcome to our support line' };
});
