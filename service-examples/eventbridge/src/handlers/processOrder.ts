import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/eventbridge';

import { ORDER_PLACED, ORDERS_SOURCE } from '../config.js';
import { withOrderContext } from '../middleware/withOrderContext.js';
import { OrderPlacedSchema } from '../utils/schemas.js';

// The ordinary path for a placed order, matched on source and detail type alone.
export const processOrder = defineRoute({
  filters: {
    source: ORDERS_SOURCE,
    detailType: ORDER_PLACED,
  },
  detailSchema: OrderPlacedSchema,
  middleware: [withOrderContext],
}).handle(async (request) => {
  logger.info({
    message: 'Order accepted for fulfilment',
    orderRef: request.detail.orderRef,
    amount: request.detail.amount,
    currency: request.detail.currency,
  });
});
