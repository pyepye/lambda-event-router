import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/vpclattice';

import { STOCK } from '../utils/inventory.js';
import { ValuationSchema } from '../utils/schemas.js';

const UNIT_VALUE_GBP = 1.4;
const WRITE_OFF_GBP = 5000;

// The write-off outweighs the holding, so the total is negative and fails the route's own
// responseSchema. The handler still runs and still logs.
export const valueStockHolding = defineRoute({
  filters: { method: 'GET', path: '/reports/valuation' },
  responseSchema: ValuationSchema,
}).handle(async () => {
  const units = Object.values(STOCK).reduce((sum, item) => sum + item.quantity, 0);
  const total = units * UNIT_VALUE_GBP - WRITE_OFF_GBP;

  logger.info({ message: 'Stock holding valued', units, total });

  return { currency: 'GBP' as const, total };
});
