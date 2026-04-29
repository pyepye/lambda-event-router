import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/sqs';

import { ConfirmationEmailMessageSchema } from '../utils/schemas.js';

export const sendConfirmationEmail = defineRoute({
  filters: {
    messageAttributes: { type: 'sendConfirmationEmail' },
  },
  bodySchema: ConfirmationEmailMessageSchema,
}).handle(async (request) => {
  const { orderId, itemCount } = request.body;

  // Would send email here
  logger.info({
    message: 'Confirmation email dispatched',
    orderId,
    itemCount,
  });
});
