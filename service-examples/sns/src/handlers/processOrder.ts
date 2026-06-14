import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/sns';

import { ORDERS_TOPIC_ARN } from '../config.js';
import { withOrderContext } from '../middleware/withOrderContext.js';
import { OrderAttributesSchema, OrderSchema } from '../utils/schemas.js';

// A new order, picked out by the `eventType` message attribute.
// The logged types show what survives the trip: only Binary reaches the handler as anything but a
// string, so `priority` and `warehouses` are whatever OrderAttributesSchema coerced them into.
export const processOrder = defineRoute({
  filters: {
    topicArn: ORDERS_TOPIC_ARN,
    messageAttributes: { eventType: 'OrderPlaced' },
  },
  bodySchema: OrderSchema,
  messageAttributesSchema: OrderAttributesSchema,
  middleware: [withOrderContext],
}).handle(async (request) => {
  const { priority, warehouses, checksum } = request.messageAttributes;

  logger.info({
    message: 'Order accepted for fulfilment',
    customer: request.body.customer,
    total: request.body.total,
    priority,
    warehouses,
    checksum: checksum?.toString('hex'),
    coercedTypes: {
      priority: typeof priority,
      warehouses: Array.isArray(warehouses),
      checksum: Buffer.isBuffer(checksum),
    },
  });
});
