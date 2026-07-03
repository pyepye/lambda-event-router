import { logger } from '@lambda-event-router/base';
import { type ApiRequest, type ApiResponse, NotFound, Ok } from '@lambda-event-router/vpclattice';

import { STOCK } from '../utils/inventory.js';
import type { TStockAdjustment } from '../utils/schemas.js';

export async function adjustStockLevel(
  request: ApiRequest<{ sku: string }, Record<string, string | undefined>, TStockAdjustment>,
): Promise<ApiResponse<{ sku: string; quantity: number }>> {
  const item = STOCK[request.path.sku];
  if (!item) throw NotFound({ error: `SKU ${request.path.sku} is not stocked` });

  logger.info({ message: 'Stock adjusted', sku: item.sku, delta: request.body.delta });

  return Ok({ sku: item.sku, quantity: item.quantity + request.body.delta });
}
