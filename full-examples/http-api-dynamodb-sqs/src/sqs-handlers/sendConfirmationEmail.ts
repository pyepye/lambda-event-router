import { logger } from '@latcher/base';
import { defineRoute } from '@latcher/sqs';

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
