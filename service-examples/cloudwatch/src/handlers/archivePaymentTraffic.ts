import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/cloudwatch';

import { PAYMENTS_LOG_GROUP_PATTERN } from '../config.js';

// Payments deliveries with nothing declined in them go straight to the archive. Same wildcard as
// quarantineDeclinedPayment, so reaching this route means the custom filter turned the delivery down.
export const archivePaymentTraffic = defineRoute({
  filters: {
    logGroup: PAYMENTS_LOG_GROUP_PATTERN,
  },
}).handle(async (request) => {
  logger.info({
    message: 'Payment traffic archived',
    logGroup: request.logGroup,
    archivedCount: request.logEvents.length,
  });
});
