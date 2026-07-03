import { logger } from '@lambda-event-router/base';
import type { ApiRequest } from '@lambda-event-router/vpclattice';

import { STOCK, type StockItem } from '../utils/inventory.js';

// Registered after GET /stock/:sku and still reached, because a literal segment outranks a param.
// Returns the body on its own, so the router picks the 200 and the JSON content type.
export async function listAvailableStock(_request: ApiRequest): Promise<StockItem[]> {
  const available = Object.values(STOCK).filter((item) => item.quantity > 0);

  logger.info({ message: 'Available stock listed', count: available.length });

  return available;
}
