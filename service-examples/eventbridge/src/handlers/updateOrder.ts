import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/eventbridge';

import { LOCAL_ACCOUNT_ID, LOCAL_REGION, ORDER_UPDATED, ORDERS_SOURCE } from '../config.js';
import { OrderUpdatedSchema } from '../utils/schemas.js';

// Order updates raised by this account in this region are the ones applied to the local store.
export const updateOrder = defineRoute({
  filters: {
    source: ORDERS_SOURCE,
    detailType: ORDER_UPDATED,
    account: LOCAL_ACCOUNT_ID,
    region: LOCAL_REGION,
  },
  detailSchema: OrderUpdatedSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Order status updated',
    orderRef: request.detail.orderRef,
    status: request.detail.status,
  });
});
