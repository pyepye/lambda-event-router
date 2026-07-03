import { defineRoute, NotFound } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURNS } from '../utils/returns.js';

// Returns an empty object, which the router answers 204. An empty array is a valid JSON body, so
// that one would be a 200.
export const releaseReturnHold = defineRoute({
  filters: { method: 'DELETE', path: '/returns/:returnId/hold' },
}).handle(async (request) => {
  const record = RETURNS[request.path.returnId];
  if (!record) throw NotFound({ error: `Return ${request.path.returnId} does not exist` });

  logger.info({ message: 'Return hold released', returnId: record.returnId });

  return {};
});
