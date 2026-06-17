import { isObject, logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/kinesis';

import { HIGH_VALUE_TOTAL, ORDERS_STREAM_ARN } from '../config.js';
import { withOrderContext } from '../middleware/withOrderContext.js';
import { OrderSchema } from '../utils/schemas.js';

// Orders at or above the high value line go to a reviewer rather than straight to fulfilment.
// The custom filter reads the decoded record before any schema runs, so it guards with isObject.
// Registered before processOrder so a high value order wins here rather than on the partition key.
export const flagHighValueOrder = defineRoute({
  filters: {
    eventSourceArn: ORDERS_STREAM_ARN,
    custom: ({ data }) => isObject(data) && typeof data.total === 'number' && data.total >= HIGH_VALUE_TOTAL,
  },
  dataSchema: OrderSchema,
  middleware: [withOrderContext],
}).handle(async (request) => {
  logger.info({
    message: 'High value order held for review',
    runId: request.data.runId,
    orderId: request.data.orderId,
    customer: request.data.customer,
    total: request.data.total,
    currency: request.data.currency,
  });
});
