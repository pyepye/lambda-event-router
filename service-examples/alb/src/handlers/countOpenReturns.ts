import { defineRoute } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURNS } from '../utils/returns.js';

// A bare number is not a JSON body and does not compile, so the count goes in an object.
export const countOpenReturns = defineRoute({
  filters: { method: 'GET', path: '/reports/returns/count' },
}).handle(async () => {
  const open = Object.values(RETURNS).filter((record) => record.state === 'open').length;

  logger.info({ message: 'Open returns counted', open });

  return { open };
});
