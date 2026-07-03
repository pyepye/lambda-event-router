import { defineRoute } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURNS, WRITE_OFFS } from '../utils/returns.js';
import { ReturnsSummarySchema } from '../utils/schemas.js';

// The desk writes off more returns than it settles, so the count is negative and fails the route's
// own responseSchema. The handler still runs and still logs.
export const summariseReturns = defineRoute({
  filters: { method: 'GET', path: '/reports/returns' },
  responseSchema: ReturnsSummarySchema,
}).handle(async () => {
  const settled = Object.values(RETURNS).filter((record) => record.state === 'settled').length - WRITE_OFFS;

  logger.info({ message: 'Returns summarised', settled });

  return { currency: 'GBP' as const, settled };
});
