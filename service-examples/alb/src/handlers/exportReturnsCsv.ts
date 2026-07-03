import { defineRoute } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURNS } from '../utils/returns.js';

// The dot in the path is a literal, so this route takes /reports/returns.csv and nothing else.
// Returning a plain string leaves the router with no JSON content type to set.
export const exportReturnsCsv = defineRoute({
  filters: { method: 'GET', path: '/reports/returns.csv' },
}).handle(async () => {
  const rows = Object.values(RETURNS).map((record) => `${record.returnId},${record.carrier},${record.units}`);

  logger.info({ message: 'Returns exported', rows: rows.length });

  return ['returnId,carrier,units', ...rows].join('\n');
});
