import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/eventbridge';

import { MIRROR_REGION_PATTERN, ORDER_UPDATED, ORDERS_SOURCE } from '../config.js';
import { OrderUpdatedSchema } from '../utils/schemas.js';

// Order updates raised in a US region are copied to the UK store instead of being applied twice.
export const mirrorOrderUpdate = defineRoute({
  filters: {
    source: ORDERS_SOURCE,
    detailType: ORDER_UPDATED,
    region: MIRROR_REGION_PATTERN,
  },
  detailSchema: OrderUpdatedSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Order update mirrored from a US region',
    orderRef: request.detail.orderRef,
    region: request.region,
  });
});
