import { type ApiRequest, type ApiResponse, Conflict, NoContent, NotFound } from '@latcher/apigateway';
import { logger } from '@latcher/base';

import { STOCK } from '../utils/warehouse.js';

// A SKU can only be discarded once its stock is down to nothing, so a SKU that still has units
// answers 409.
export async function discardStockRecord(request: ApiRequest<{ sku: string }>): Promise<ApiResponse<undefined>> {
  const record = STOCK[request.path.sku];
  if (!record) throw NotFound(`SKU ${request.path.sku} is not stocked`);

  if (record.quantity > 0) {
    throw Conflict(`SKU ${record.sku} still holds ${record.quantity} units`);
  }

  logger.info({ message: 'Stock record discarded', sku: record.sku });

  return NoContent();
}
