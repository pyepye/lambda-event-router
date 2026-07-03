import { logger } from '@lambda-event-router/base';
import { type ApiRequest, type ApiResponse, Conflict, Created } from '@lambda-event-router/vpclattice';

import { STOCK, type StockItem } from '../utils/inventory.js';
import type { TNewStockItem } from '../utils/schemas.js';

export async function createStockItem(
  request: ApiRequest<Record<string, string>, Record<string, string | undefined>, TNewStockItem>,
): Promise<ApiResponse<StockItem>> {
  const { sku, description, quantity } = request.body;
  if (STOCK[sku]) throw Conflict({ error: `SKU ${sku} is already stocked` });

  logger.info({ message: 'Stock item created', sku, quantity });

  return Created({ sku, description, quantity, depot: 'leeds' });
}
