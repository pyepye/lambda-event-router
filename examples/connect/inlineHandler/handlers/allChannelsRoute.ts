import { defineRoute } from '@lambda-event-router/connect';

import { INSTANCE_ARN } from '../constants.js';

// Matches all channels and initiation methods for this instance
export const allChannelsRoute = defineRoute({
  filters: {
    instanceArn: INSTANCE_ARN,
  },
}).handle(async ({ contactData }) => {
  const channel = contactData.Channel;
  const initiationMethod = contactData.InitiationMethod;
  console.log(`Contact received: ${channel} via ${initiationMethod}`);

  return { routed: 'true', channel };
});
