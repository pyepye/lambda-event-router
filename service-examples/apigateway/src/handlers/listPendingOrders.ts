import type { ApiRequest } from '@latcher/apigateway';
import { logger } from '@latcher/base';

import { pendingOrders, type WarehouseOrder } from '../utils/warehouse.js';

// Registered after GET /orders/:orderId and still reached, because a literal segment outranks a
// path param. Returning the array on its own answers 200 with a JSON body.
export async function listPendingOrders(request: ApiRequest): Promise<WarehouseOrder[]> {
  const orders = pendingOrders();

  logger.info({ message: 'Pending orders listed', count: orders.length, rawPath: request.rawPath });

  return orders;
}
