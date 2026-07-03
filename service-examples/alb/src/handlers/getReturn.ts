import { defineRoute, NotFound, Ok } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { DESK_HEADER, RETURN_VERSION_HEADER } from '../utils/constants.js';
import { RETURNS } from '../utils/returns.js';
import { ReturnQuerySchema } from '../utils/schemas.js';

// The route the two event forms differ on. A caller scopes the read by repeating `carrier` and
// `x-desk`, and only a multi-value target group carries more than one value for either. `reason`
// comes back as it arrived, because ALB hands over the query string still percent encoded.
export const getReturn = defineRoute({
  filters: { method: 'GET', path: '/returns/:returnId' },
  querySchema: ReturnQuerySchema,
}).handle(async (request) => {
  const record = RETURNS[request.path.returnId];
  if (!record) throw NotFound({ error: `Return ${request.path.returnId} does not exist` });

  const carriers = request.multiValueQuery.carrier ?? [];

  logger.info({
    message: 'Return read',
    returnId: record.returnId,
    page: request.query.page,
    expand: request.query.expand,
    reason: request.query.reason,
    carrier: request.query.carrier,
    carriers,
    deskHeader: request.headers[DESK_HEADER],
    deskHeaders: request.multiValueHeaders[DESK_HEADER],
    targetGroupArn: request.auth?.targetGroupArn,
    principalId: request.auth?.principalId,
  });

  return Ok(
    {
      record,
      page: request.query.page,
      carriers,
      deskHeaders: request.multiValueHeaders[DESK_HEADER] ?? [],
      reason: request.query.reason,
      auth: request.auth,
    },
    { [RETURN_VERSION_HEADER]: '3' },
  );
});
