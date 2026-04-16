import { type ConnectFilterInput, defineRoute } from '@lambda-event-router/connect';

import { INSTANCE_ARN } from '../constants.js';

export const voiceInboundRoute = defineRoute({
  filters: {
    channel: 'VOICE',
    initiationMethod: 'INBOUND',
    instanceArn: INSTANCE_ARN,
  },
}).handle(async ({ contactData }) => {
  const customerNumber = contactData.CustomerEndpoint?.Address;
  const systemNumber = contactData.SystemEndpoint?.Address;
  console.log(`Inbound voice call from ${customerNumber} to ${systemNumber}`);

  return { greeting: 'Welcome to our support line' };
});

// Match VIP callers based on contact attributes using customFilter
export const vipCallerRoute = defineRoute({
  filters: {
    channel: 'VOICE',
    initiationMethod: 'INBOUND',
    instanceArn: INSTANCE_ARN,
    customFilter: ({ event }: ConnectFilterInput) => {
      const contactAttributes = event.Details.ContactData.Attributes;
      const vipTier = 'platinum';
      return contactAttributes.customerTier === vipTier;
    },
  },
}).handle(async ({ contactData }) => {
  const customerNumber = contactData.CustomerEndpoint?.Address;
  console.log(`VIP caller: ${customerNumber}`);

  return { greeting: 'Welcome to our priority support line' };
});
