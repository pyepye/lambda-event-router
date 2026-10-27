import { type ApiRequest, type ApiResponse, NotFound, Ok } from '@latcher/apigateway';
import { logger } from '@latcher/base';

import { STOCK, type StockRecord } from '../utils/warehouse.js';

// A HEAD response keeps the status and the headers a GET would return and carries no body. The
// matcher strips the body, so the handler builds the same response as the GET route.
export async function headStockRecord(
  request: ApiRequest<{ sku: string }>,
): Promise<ApiResponse<StockRecord | { error: string }>> {
  const record = STOCK[request.path.sku];
  if (!record) throw NotFound(`SKU ${request.path.sku} is not stocked`);

  logger.info({ message: 'Stock record checked', sku: record.sku });

  return Ok(record, { 'x-stock-quantity': String(record.quantity) });
}
