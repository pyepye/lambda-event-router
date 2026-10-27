import { defineRoute, NoContent, NotFound } from '@latcher/alb';
import { logger } from '@latcher/base';

import { RETURNS } from '../utils/returns.js';

// Answers 204 with no body, the usual answer to a DELETE.
export const releaseReturnHold = defineRoute({
  filters: { method: 'DELETE', path: '/returns/:returnId/hold' },
}).handle(async (request) => {
  const record = RETURNS[request.path.returnId];
  if (!record) throw NotFound(`Return ${request.path.returnId} does not exist`);

  logger.info({ message: 'Return hold released', returnId: record.returnId });

  return NoContent();
});
