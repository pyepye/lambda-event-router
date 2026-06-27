import { defineRoute, NotFound, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { STOCK } from '../utils/warehouse.js';

// An HTTP API route on payload format 2.0. That payload has no multi-value form, so a query param
// sent twice arrives as one comma-joined string and the multi-value map holds that single string.
export const getStockRecord = defineRoute({
  filters: { method: 'GET', path: '/inventory/:sku' },
}).handle(async (request) => {
  const record = STOCK[request.path.sku];
  if (!record) throw NotFound({ error: `SKU ${request.path.sku} is not stocked` });

  logger.info({
    message: 'Stock record read',
    sku: record.sku,
    depot: request.query.depot,
    depots: request.multiValueQuery.depot,
  });

  return Ok(record);
});
