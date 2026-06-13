import { isObject, logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/sqs';

import { NOTIFICATIONS_QUEUE_ARN } from '../config.js';
import { NotificationSchema } from '../utils/schemas.js';

// Marketing notifications are held for later batching rather than sent straight away.
// The custom filter reads the raw body before any schema runs, so it guards with isObject.
// Registered before sendEmail so a marketing message wins here rather than on the channel filter.
export const holdMarketing = defineRoute({
  filters: {
    eventSourceArn: NOTIFICATIONS_QUEUE_ARN,
    custom: ({ body }) => isObject(body) && body.category === 'marketing',
  },
  bodySchema: NotificationSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Marketing notification held for batching',
    recipient: request.body.recipient,
    subject: request.body.subject,
  });
});
