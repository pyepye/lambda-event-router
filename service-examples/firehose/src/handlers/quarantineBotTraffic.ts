import { defineRoute } from '@lambda-event-router/firehose';

import { BOT_USER_AGENT_MARKER, CLICKSTREAM_ARN } from '../config.js';
import { userAgentOf } from '../utils/events.js';

// Traffic from a bot is refused whatever event it claims to be. Registered before recordPageView, so a
// page view with a bot user agent lands here rather than there.
//
// The throw is the only failure in this example that the router logs an error for. A handler that
// returns Failed() reaches the same result without one.
export const quarantineBotTraffic = defineRoute({
  filters: {
    deliveryStreamArn: CLICKSTREAM_ARN,
    custom: ({ data }) => userAgentOf(data)?.toLowerCase().includes(BOT_USER_AGENT_MARKER) === true,
  },
}).handle(async ({ recordId }) => {
  throw new Error(`Bot traffic refused for record ${recordId}`);
});
