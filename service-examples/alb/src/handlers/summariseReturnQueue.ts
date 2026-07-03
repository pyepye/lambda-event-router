import { defineRoute, Ok } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURNS, WRITE_OFFS } from '../utils/returns.js';
import { ReturnQueueSchema } from '../utils/schemas.js';

// The count is negative and the route's own responseSchema rejects a negative one. The handler
// builds the response itself, and the router validates only a bare value, so this one answers 200.
export const summariseReturnQueue = defineRoute({
  filters: { method: 'GET', path: '/reports/returns/queue' },
  responseSchema: ReturnQueueSchema,
}).handle(async () => {
  const queued = Object.values(RETURNS).filter((record) => record.state === 'open').length - WRITE_OFFS;

  logger.info({ message: 'Return queue summarised', queued });

  return Ok({ currency: 'GBP' as const, queued });
});
