import { isObject, logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/eventbridge';

import { HIGH_VALUE_THRESHOLD_PENCE, ORDER_PLACED, ORDERS_SOURCE } from '../config.js';
import { OrderPlacedSchema } from '../utils/schemas.js';

// Orders at or above the review threshold are held for a human rather than processed.
// The custom filter reads the raw detail before any schema runs, so it guards with isObject.
// Registered before processOrder, which matches the same source and detail type and would
// otherwise take these.
export const flagHighValueOrder = defineRoute({
  filters: {
    source: ORDERS_SOURCE,
    detailType: ORDER_PLACED,
    custom: ({ detail }) =>
      isObject(detail) && typeof detail.amount === 'number' && detail.amount >= HIGH_VALUE_THRESHOLD_PENCE,
  },
  detailSchema: OrderPlacedSchema,
}).handle(async (request) => {
  logger.info({
    message: 'High value order flagged for review',
    orderRef: request.detail.orderRef,
    amount: request.detail.amount,
    currency: request.detail.currency,
  });
});
