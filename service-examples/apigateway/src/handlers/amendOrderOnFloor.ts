import { defineRoute } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { CHANNEL_HEADER, WAREHOUSE_FLOOR_CHANNEL } from '../utils/constants.js';
import { OrderAmendmentSchema } from '../utils/schemas.js';

// Amendments raised on a handheld terminal go through a floor-specific path. The custom filter reads
// the raw headers before any schema runs, and this route is registered before the general PATCH so
// a floor request lands here. Returning nothing answers 204.
export const amendOrderOnFloor = defineRoute({
  filters: {
    method: 'PATCH',
    path: '/orders/:orderId',
    custom: ({ headers }) => headers[CHANNEL_HEADER] === WAREHOUSE_FLOOR_CHANNEL,
  },
  bodySchema: OrderAmendmentSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Order amended on the warehouse floor',
    orderId: request.path.orderId,
    status: request.body.status,
  });
});
