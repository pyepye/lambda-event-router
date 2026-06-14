import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/sns';

import { INVENTORY_TOPIC_ARN } from '../config.js';
import { StockMovementSchema } from '../utils/schemas.js';

// Stock reservations arrive on the inventory topic. `schemaVersion` is published as a Number and
// filtered as the string '2', because that is what SNS delivers. A version 1 message matches no route.
export const reserveStock = defineRoute({
  filters: {
    topicArn: INVENTORY_TOPIC_ARN,
    messageAttributes: { schemaVersion: '2' },
  },
  bodySchema: StockMovementSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Stock reserved',
    sku: request.body.sku,
    orderId: request.body.orderId,
    quantity: request.body.quantity,
  });
});
