import { defineRoute } from '@lambda-event-router/amazon-connect';

import { INSTANCE_ARN } from '../constants.js';

// Matches all channels and initiation methods for this instance
export const allChannelsRoute = defineRoute({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
}).handle(async ({ contactData }) => {
  const channel = contactData.Channel;
  const initiationMethod = contactData.InitiationMethod;
  console.log(`Contact received: ${channel} via ${initiationMethod}`);

  return { routed: 'true', channel };
});
