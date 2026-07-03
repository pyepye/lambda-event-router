import { logger } from '@lambda-event-router/base';
import { defineRoute, NotFound, Ok } from '@lambda-event-router/vpclattice';

import { CHANNEL_HEADER, WAREHOUSE_FLOOR_CHANNEL } from '../utils/constants.js';
import { STOCK } from '../utils/inventory.js';
import { StockAdjustmentSchema } from '../utils/schemas.js';

// The custom filter reads a header, which no other filter key on this router can see. It is
// registered ahead of the plain PATCH route, which matches the same method and path.
export const adjustStockOnFloor = defineRoute({
  filters: {
    method: 'PATCH',
    path: '/stock/:sku',
    custom: ({ headers }) => headers[CHANNEL_HEADER] === WAREHOUSE_FLOOR_CHANNEL,
  },
  bodySchema: StockAdjustmentSchema,
}).handle(async (request) => {
  const item = STOCK[request.path.sku];
  if (!item) throw NotFound({ error: `SKU ${request.path.sku} is not stocked` });

  logger.info({
    message: 'Stock adjusted on the warehouse floor',
    sku: item.sku,
    delta: request.body.delta,
    reason: request.body.reason,
  });

  return Ok({ sku: item.sku, quantity: item.quantity + request.body.delta });
});
