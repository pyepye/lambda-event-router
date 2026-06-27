import { type ApiRequest, type ApiResponse, NotFound, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import type { TStockAdjustment } from '../utils/schemas.js';
import { STOCK } from '../utils/warehouse.js';

// Behind the HTTP API's simple-response authorizer. That authorizer answers with a boolean and no
// context, so `auth` reports what API Gateway puts on the request rather than anything the
// authorizer chose.
export async function adjustStock(
  request: ApiRequest<{ sku: string }, Record<string, string | undefined>, TStockAdjustment>,
): Promise<ApiResponse<{ sku: string; quantity: number }>> {
  const record = STOCK[request.path.sku];
  if (!record) throw NotFound({ error: `SKU ${request.path.sku} is not stocked` });

  logger.info({
    message: 'Stock adjusted',
    sku: record.sku,
    delta: request.body.delta,
    reason: request.body.reason,
    auth: request.auth,
  });

  return Ok({ sku: record.sku, quantity: record.quantity + request.body.delta });
}
