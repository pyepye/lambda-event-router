import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/vpclattice';

import { STOCK } from '../utils/inventory.js';

// The dot in the path is a literal, so this route takes /reports/valuation.csv and nothing else.
// Returning a plain string leaves the router with no JSON content type to set.
export const exportStockValuation = defineRoute({
  filters: { method: 'GET', path: '/reports/valuation.csv' },
}).handle(async () => {
  const rows = Object.values(STOCK).map((item) => `${item.sku},${item.depot},${item.quantity}`);

  logger.info({ message: 'Stock valuation exported', rows: rows.length });

  return ['sku,depot,quantity', ...rows].join('\n');
});
