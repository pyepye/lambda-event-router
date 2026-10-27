import { logger } from '@latcher/base';
import { defineRoute } from '@latcher/vpclattice';

import { STOCK } from '../utils/inventory.js';

// The dot in the path is a literal, so this route takes /reports/valuation.csv and nothing else.
// A text route sends the string as it is, with the content type it names.
export const exportStockValuation = defineRoute({
  filters: { method: 'GET', path: '/reports/valuation.csv' },
  responseType: { type: 'text', contentType: 'text/csv' },
}).handle(async () => {
  const rows = Object.values(STOCK).map((item) => `${item.sku},${item.depot},${item.quantity}`);

  logger.info({ message: 'Stock valuation exported', rows: rows.length });

  return ['sku,depot,quantity', ...rows].join('\n');
});
