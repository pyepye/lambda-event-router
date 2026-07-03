import { logger } from '@lambda-event-router/base';
import { defineRoute, NotFound, PermanentRedirect, TemporaryRedirect } from '@lambda-event-router/vpclattice';

import { SKUS_UNDER_REVIEW, SUCCESSOR_SKUS } from '../utils/inventory.js';

// A retired SKU with a successor moves for good, so it answers 308. One still under review may
// come back, so it answers 307 and points at the review queue.
export const redirectRetiredSku = defineRoute({
  filters: { method: 'GET', path: '/stock/retired/:sku' },
}).handle(async (request) => {
  const { sku } = request.path;
  const successor = SUCCESSOR_SKUS[sku];

  if (successor) {
    logger.info({ message: 'Retired SKU redirected', sku, successor });
    return PermanentRedirect(`/stock/${successor}`);
  }

  if (SKUS_UNDER_REVIEW.includes(sku)) {
    logger.info({ message: 'SKU under review redirected', sku });
    return TemporaryRedirect('/reports/valuation');
  }

  throw NotFound({ error: `SKU ${sku} has not been retired` });
});
