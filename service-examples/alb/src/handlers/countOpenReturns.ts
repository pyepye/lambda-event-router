import { defineRoute } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURNS } from '../utils/returns.js';

// Returns a number on its own. The router sends it back as the body and sets no JSON content type,
// because only an object or an array gets one.
export const countOpenReturns = defineRoute({
  filters: { method: 'GET', path: '/reports/returns/count' },
}).handle(async () => {
  const open = Object.values(RETURNS).filter((record) => record.state === 'open').length;

  logger.info({ message: 'Open returns counted', open });

  return open;
});
