import { defineRoute } from '@lambda-event-router/amazon-connect';

import { INSTANCE_ARN } from '../constants.js';

export const callbackRoute = defineRoute({
  filters: {
    initiationMethods: ['CALLBACK'],
    instanceArns: [INSTANCE_ARN],
  },
}).handle(async ({ contactData }) => {
  const queueName = contactData.Queue?.Name;
  const customerNumber = contactData.CustomerEndpoint?.Address;
  console.log(`Callback requested by ${customerNumber} from queue ${queueName}`);

  return { status: 'callback_initiated' };
});
