import { defineRoute, NotFound, Ok } from '@latcher/apigateway';
import { logger } from '@latcher/base';

import { reconciliationAuth } from '../utils/auth.js';
import { StockAdjustmentSchema } from '../utils/schemas.js';
import { STOCK } from '../utils/warehouse.js';

// Behind the HTTP API's policy-mode authorizer, which returns a context.
export const reconcileStock = defineRoute({
  filters: { method: 'PATCH', path: '/inventory/:sku' },
  auth: reconciliationAuth,
  bodySchema: StockAdjustmentSchema,
}).handle(async (request) => {
  const record = STOCK[request.path.sku];
  if (!record) throw NotFound(`SKU ${request.path.sku} is not stocked`);

  logger.info({
    message: 'Stock reconciled',
    sku: record.sku,
    delta: request.body.delta,
    authorizerContext: request.auth.context,
  });

  return Ok({ sku: record.sku, counted: record.quantity + request.body.delta });
});
