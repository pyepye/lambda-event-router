import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/sqs';

import { NOTIFICATIONS_QUEUE_ARN } from '../config.js';
import { NotificationAttributesSchema, NotificationSchema } from '../utils/schemas.js';

// Transactional email, picked out by the `channel` message attribute.
export const sendEmail = defineRoute({
  filters: {
    eventSourceArn: NOTIFICATIONS_QUEUE_ARN,
    messageAttributes: { channel: 'email' },
  },
  bodySchema: NotificationSchema,
  messageAttributesSchema: NotificationAttributesSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Email sent',
    recipient: request.body.recipient,
    subject: request.body.subject,
    channel: request.messageAttributes.channel,
    retryCount: request.messageAttributes.retryCount, // converted by schema
  });
});
