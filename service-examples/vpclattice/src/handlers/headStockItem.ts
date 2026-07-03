import { logger } from '@lambda-event-router/base';
import { type ApiRequest, type ApiResponse, NotFound, Ok } from '@lambda-event-router/vpclattice';

import { STOCK_VERSION_HEADER } from '../utils/constants.js';
import { STOCK, type StockItem } from '../utils/inventory.js';

// Builds the same response the GET route does. The router drops the body and keeps the status and
// the headers, so a HEAD answers 200 with nothing in it.
export async function headStockItem(request: ApiRequest<{ sku: string }>): Promise<ApiResponse<StockItem>> {
  const item = STOCK[request.path.sku];
  if (!item) throw NotFound({ error: `SKU ${request.path.sku} is not stocked` });

  logger.info({ message: 'Stock item checked', sku: item.sku });

  return Ok(item, { [STOCK_VERSION_HEADER]: '4' });
}
