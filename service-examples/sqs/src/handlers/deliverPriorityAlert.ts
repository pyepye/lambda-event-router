import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/sqs';

import { PRIORITY_QUEUE_ARN } from '../config.js';
import { withAlertContext } from '../middleware/withAlertContext.js';
import { PriorityAlertSchema } from '../utils/schemas.js';

// Priority alerts arrive on the FIFO queue, ordered per tenant (the MessageGroupId), and are
// matched by eventSourceArn alone. A body that fails PriorityAlertSchema throws, which the router
// reports as a batch item failure; on a FIFO queue that record and the rest of its group retry
// together, so ordering survives.
export const deliverPriorityAlert = defineRoute({
  filters: {
    eventSourceArn: PRIORITY_QUEUE_ARN,
  },
  bodySchema: PriorityAlertSchema,
  middleware: [withAlertContext],
}).handle(async (request) => {
  logger.info({
    message: 'Priority alert delivered',
    tenantId: request.body.tenantId,
    alertId: request.body.alertId,
    severity: request.body.severity,
  });
});
