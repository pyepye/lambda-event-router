import { defineRoute, NotFound } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURNS } from '../utils/returns.js';

// Returns a boolean on its own, and the two values answer differently. A bare `true` is no content
// to the router, so a return waiting for a carrier answers 204. A bare `false` is a body, so it
// answers 200.
export const checkReturnPickup = defineRoute({
  filters: { method: 'GET', path: '/returns/:returnId/pickup' },
}).handle(async (request) => {
  const record = RETURNS[request.path.returnId];
  if (!record) throw NotFound({ error: `Return ${request.path.returnId} does not exist` });

  const awaitingPickup = record.units > 0;

  logger.info({ message: 'Return pickup checked', returnId: record.returnId, awaitingPickup });

  return awaitingPickup;
});
