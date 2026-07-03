import { logger } from '@lambda-event-router/base';
import { defineRoute, NotFound, Ok, type VPCLatticeEvent } from '@lambda-event-router/vpclattice';

import { DEPOT_HEADER, STOCK_VERSION_HEADER } from '../utils/constants.js';
import { STOCK } from '../utils/inventory.js';
import { StockQuerySchema } from '../utils/schemas.js';

// The route the payload versions differ on. A caller scopes the read by repeating `depot`, and a
// 2.0 payload keeps every value where a 1.0 payload carries one string per name.
export const getStockItem = defineRoute({
  filters: { method: 'GET', path: '/stock/:sku' },
  querySchema: StockQuerySchema,
}).handle(async (request) => {
  const item = STOCK[request.path.sku];
  if (!item) throw NotFound({ error: `SKU ${request.path.sku} is not stocked` });

  const event = request.event as VPCLatticeEvent;
  const depots = request.multiValueQuery.depot ?? [];

  logger.info({
    message: 'Stock item read',
    sku: item.sku,
    page: request.query.page,
    expand: request.query.expand,
    depot: request.query.depot,
    depots,
    depotHeader: request.headers[DEPOT_HEADER],
    depotHeaders: request.multiValueHeaders[DEPOT_HEADER],
    principalId: request.auth?.principalId,
    serviceArn: 'requestContext' in event ? event.requestContext.serviceArn : undefined,
  });

  return Ok({ item, page: request.query.page, depots }, { [STOCK_VERSION_HEADER]: '4' });
});
