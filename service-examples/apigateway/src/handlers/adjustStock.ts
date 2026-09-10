import { type ApiRequest, type ApiResponse, type AuthOf, NotFound, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import type { stockAdjustmentAuth } from '../utils/auth.js';
import type { TStockAdjustment } from '../utils/schemas.js';
import { STOCK } from '../utils/warehouse.js';

// Behind the HTTP API's simple-response authorizer, which answers with a boolean and no context.
export async function adjustStock(
  request: ApiRequest<
    { sku: string },
    Record<string, string | undefined>,
    AuthOf<typeof stockAdjustmentAuth>,
    TStockAdjustment
  >,
): Promise<ApiResponse<{ sku: string; quantity: number }>> {
  const record = STOCK[request.path.sku];
  if (!record) throw NotFound(`SKU ${request.path.sku} is not stocked`);

  logger.info({
    message: 'Stock adjusted',
    sku: record.sku,
    delta: request.body.delta,
    reason: request.body.reason,
    auth: request.auth,
  });

  return Ok({ sku: record.sku, quantity: record.quantity + request.body.delta });
}
