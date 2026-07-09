import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/cloudwatch';

import { DECLINED_PAYMENT_MARKER, PAYMENTS_LOG_GROUP_PATTERN } from '../config.js';

// A declined payment anywhere in the delivery holds the whole batch back for review. The custom
// filter reads the log events, which is the only thing separating this route from
// archivePaymentTraffic. Registered first so a delivery carrying a decline lands here.
export const quarantineDeclinedPayment = defineRoute({
  filters: {
    logGroup: PAYMENTS_LOG_GROUP_PATTERN,
    custom: ({ logEvents }) => logEvents.some((event) => event.message.includes(DECLINED_PAYMENT_MARKER)),
  },
}).handle(async (request) => {
  const declined = request.logEvents.filter((event) => event.message.includes(DECLINED_PAYMENT_MARKER));

  logger.info({
    message: 'Declined payment quarantined',
    logGroup: request.logGroup,
    declinedCount: declined.length,
    heldCount: request.logEvents.length,
  });
});
