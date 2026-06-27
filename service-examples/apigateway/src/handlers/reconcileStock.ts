import { defineRoute, NotFound, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { StockAdjustmentSchema } from '../utils/schemas.js';
import { STOCK } from '../utils/warehouse.js';

// Behind the HTTP API's policy-mode authorizer, which returns a context. An HTTP API nests that
// context under `lambda`, so it reaches the handler as `auth.context.lambda`.
export const reconcileStock = defineRoute({
  filters: { method: 'PATCH', path: '/inventory/:sku' },
  bodySchema: StockAdjustmentSchema,
}).handle(async (request) => {
  const record = STOCK[request.path.sku];
  if (!record) throw NotFound({ error: `SKU ${request.path.sku} is not stocked` });

  logger.info({
    message: 'Stock reconciled',
    sku: record.sku,
    delta: request.body.delta,
    authorizerContext: request.auth?.context,
  });

  return Ok({ sku: record.sku, counted: record.quantity + request.body.delta });
});
