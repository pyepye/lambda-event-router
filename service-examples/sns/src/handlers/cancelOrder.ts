import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/sns';

import { ORDERS_TOPIC_ARN } from '../config.js';
import { CancellationSchema } from '../utils/schemas.js';

// Cancellations carry no message attributes, so the SNS subject is what picks them out.
// A record published without a subject can never match this route.
export const cancelOrder = defineRoute({
  filters: {
    topicArn: ORDERS_TOPIC_ARN,
    subject: 'Order cancelled',
  },
  bodySchema: CancellationSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Order cancelled',
    orderId: request.body.orderId,
    reason: request.body.reason,
  });
});
