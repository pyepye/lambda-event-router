import { defineRoute, NotFound, Ok } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { CHANNEL_HEADER, RETURNS_DESK_CHANNEL } from '../utils/constants.js';
import { RETURNS } from '../utils/returns.js';
import { ReturnAmendmentSchema } from '../utils/schemas.js';

// The custom filter reads a header, which no other filter key on this router can see. It is
// registered ahead of the plain PATCH route, which matches the same method and path.
export const amendReturnAtDesk = defineRoute({
  filters: {
    method: 'PATCH',
    path: '/returns/:returnId',
    custom: ({ headers }) => headers[CHANNEL_HEADER] === RETURNS_DESK_CHANNEL,
  },
  bodySchema: ReturnAmendmentSchema,
}).handle(async (request) => {
  const record = RETURNS[request.path.returnId];
  if (!record) throw NotFound({ error: `Return ${request.path.returnId} does not exist` });

  logger.info({
    message: 'Return amended at the desk',
    returnId: record.returnId,
    units: request.body.units,
    reason: request.body.reason,
  });

  return Ok({ returnId: record.returnId, units: record.units + request.body.units });
});
