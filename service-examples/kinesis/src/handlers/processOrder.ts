import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/kinesis';

import { ORDERS_STREAM_ARN } from '../config.js';
import { OrderSchema } from '../utils/schemas.js';

// Ordinary orders, picked out by a partition key of `customer-<id>`. An orders record with any other
// partition key falls past this route and matches nothing.
export const processOrder = defineRoute({
  filters: {
    eventSourceArn: ORDERS_STREAM_ARN,
    partitionKey: 'customer-*',
  },
  dataSchema: OrderSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Order accepted for fulfilment',
    runId: request.data.runId,
    orderId: request.data.orderId,
    customer: request.data.customer,
    total: request.data.total,
    totalType: typeof request.data.total,
  });
});
