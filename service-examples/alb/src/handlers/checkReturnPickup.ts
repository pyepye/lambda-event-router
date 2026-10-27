import { defineRoute, NotFound } from '@latcher/alb';
import { logger } from '@latcher/base';

import { RETURNS } from '../utils/returns.js';

// A bare boolean is not a JSON body and does not compile, so the answer goes in an object.
export const checkReturnPickup = defineRoute({
  filters: { method: 'GET', path: '/returns/:returnId/pickup' },
}).handle(async (request) => {
  const record = RETURNS[request.path.returnId];
  if (!record) throw NotFound(`Return ${request.path.returnId} does not exist`);

  const awaitingPickup = record.units > 0;

  logger.info({ message: 'Return pickup checked', returnId: record.returnId, awaitingPickup });

  return { returnId: record.returnId, awaitingPickup };
});
