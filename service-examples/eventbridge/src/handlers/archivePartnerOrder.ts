import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/eventbridge';

import { ORDER_UPDATED, ORDERS_SOURCE, PARTNER_ACCOUNT_ID } from '../config.js';
import { OrderUpdatedSchema } from '../utils/schemas.js';

// A partner account puts its own order updates on this bus. They are archived rather than applied.
export const archivePartnerOrder = defineRoute({
  filters: {
    source: ORDERS_SOURCE,
    detailType: ORDER_UPDATED,
    account: PARTNER_ACCOUNT_ID,
  },
  detailSchema: OrderUpdatedSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Partner order update archived',
    orderRef: request.detail.orderRef,
    account: request.account,
  });
});
