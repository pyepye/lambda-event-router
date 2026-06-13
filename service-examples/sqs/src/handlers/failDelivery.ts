import { defineRoute } from '@lambda-event-router/sqs';

import { NOTIFICATIONS_QUEUE_ARN } from '../config.js';
import { NotificationSchema } from '../utils/schemas.js';

// SMS delivery always throws, which is the only route here that fails inside the handler rather than
// on its schema. The distinction shows in the logs: the middleware chain has already run by the time
// the handler throws, so this record has a logInvocation line. A record that fails validation has none.
export const failDelivery = defineRoute({
  filters: {
    eventSourceArn: NOTIFICATIONS_QUEUE_ARN,
    messageAttributes: { channel: 'sms' },
  },
  bodySchema: NotificationSchema,
}).handle(async (request) => {
  throw new Error(`SMS gateway unavailable for ${request.body.recipient}`);
});
