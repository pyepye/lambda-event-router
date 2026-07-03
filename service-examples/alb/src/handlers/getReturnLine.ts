import { defineRoute, NotFound } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURN_LINES } from '../utils/returns.js';

// Two path params in one pattern, both typed from the pattern and both handed to the handler.
// Returns the line on its own, so the router picks the 200 and the JSON content type.
export const getReturnLine = defineRoute({
  filters: { method: 'GET', path: '/returns/:returnId/lines/:lineId' },
}).handle(async (request) => {
  const line = RETURN_LINES[request.path.lineId];
  if (!line || line.returnId !== request.path.returnId) {
    throw NotFound({ error: `Line ${request.path.lineId} does not exist on ${request.path.returnId}` });
  }

  logger.info({ message: 'Return line read', returnId: request.path.returnId, lineId: line.lineId });

  return line;
});
