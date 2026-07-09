import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/cloudwatch';

import { CHECKOUT_ERRORS_FILTER } from '../config.js';
import { withIncidentContext } from '../middleware/withIncidentContext.js';

// Checkout error lines reach the on-call rota. The checkout log group has a second subscription
// filter pointing at the same worker, so the filter name is what separates the two deliveries.
// Registered before indexCheckoutTraffic, which would otherwise claim this delivery on its log group.
export const escalateCheckoutFailure = defineRoute({
  filters: {
    subscriptionFilter: CHECKOUT_ERRORS_FILTER,
  },
  middleware: [withIncidentContext],
}).handle(async (request) => {
  logger.info({
    message: 'Checkout failure escalated',
    logGroup: request.logGroup,
    logStream: request.logStream,
    errorCount: request.logEvents.length,
    firstError: request.logEvents[0]?.message,
  });
});
