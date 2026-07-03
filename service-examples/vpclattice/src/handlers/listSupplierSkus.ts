import { logger } from '@lambda-event-router/base';
import { defineRoute, NotFound, Ok } from '@lambda-event-router/vpclattice';

import { requireCallerPrincipal } from '../middleware/requireCallerPrincipal.js';
import { SUPPLIER_SKUS } from '../utils/inventory.js';

// The only route that needs a caller identity, so it is the only one an unsigned caller cannot
// reach.
export const listSupplierSkus = defineRoute({
  filters: { method: 'GET', path: '/suppliers/:supplierId/skus' },
  middleware: [requireCallerPrincipal],
}).handle(async (request) => {
  const skus = SUPPLIER_SKUS[request.path.supplierId];
  if (!skus) throw NotFound({ error: `Supplier ${request.path.supplierId} is not known` });

  logger.info({ message: 'Supplier SKUs listed', supplierId: request.path.supplierId, count: skus.length });

  return Ok({ supplierId: request.path.supplierId, skus });
});
