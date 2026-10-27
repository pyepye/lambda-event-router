import { defineRoute } from '@latcher/alb';
import { logger } from '@latcher/base';

import { RETURNS } from '../utils/returns.js';

// The dot in the path is a literal, so this route takes /reports/returns.csv and nothing else.
// A text route sends the string as it is, with the content type it names.
export const exportReturnsCsv = defineRoute({
  filters: { method: 'GET', path: '/reports/returns.csv' },
  responseType: { type: 'text', contentType: 'text/csv' },
}).handle(async () => {
  const rows = Object.values(RETURNS).map((record) => `${record.returnId},${record.carrier},${record.units}`);

  logger.info({ message: 'Returns exported', rows: rows.length });

  return ['returnId,carrier,units', ...rows].join('\n');
});
