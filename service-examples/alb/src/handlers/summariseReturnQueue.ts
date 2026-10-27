import { defineRoute, Ok } from '@latcher/alb';
import { logger } from '@latcher/base';

import { RETURNS, WRITE_OFFS } from '../utils/returns.js';
import { ReturnQueueSchema } from '../utils/schemas.js';

// The count is negative and the route's own responseSchema rejects a negative one. The matcher checks
// a body returned through Ok() too, so this one answers 500.
export const summariseReturnQueue = defineRoute({
  filters: { method: 'GET', path: '/reports/returns/queue' },
  responseSchema: ReturnQueueSchema,
}).handle(async () => {
  const queued = Object.values(RETURNS).filter((record) => record.state === 'open').length - WRITE_OFFS;

  logger.info({ message: 'Return queue summarised', queued });

  return Ok({ currency: 'GBP' as const, queued });
});
