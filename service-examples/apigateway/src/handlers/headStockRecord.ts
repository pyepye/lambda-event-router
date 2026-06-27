import { type ApiRequest, type ApiResponse, NotFound, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { STOCK, type StockRecord } from '../utils/warehouse.js';

// A HEAD response keeps the status and the headers a GET would return and carries no body. The
// router strips the body, so the handler builds the same response as the GET route.
export async function headStockRecord(
  request: ApiRequest<{ sku: string }>,
): Promise<ApiResponse<StockRecord | { error: string }>> {
  const record = STOCK[request.path.sku];
  if (!record) throw NotFound({ error: `SKU ${request.path.sku} is not stocked` });

  logger.info({ message: 'Stock record checked', sku: record.sku });

  return Ok(record, { 'x-stock-quantity': String(record.quantity) });
}
