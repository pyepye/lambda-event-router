import { defineRoute } from '@lambda-event-router/connect';

import { INSTANCE_ARN } from '../constants.js';

export const callbackRoute = defineRoute({
  filters: {
    initiationMethod: 'CALLBACK',
    instanceArn: INSTANCE_ARN,
  },
}).handle(async ({ contactData }) => {
  const queueName = contactData.Queue?.Name;
  const customerNumber = contactData.CustomerEndpoint?.Address;
  console.log(`Callback requested by ${customerNumber} from queue ${queueName}`);

  return { status: 'callback_initiated' };
});
