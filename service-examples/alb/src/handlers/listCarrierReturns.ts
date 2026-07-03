import { defineRoute, NotFound, Ok } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { requireDeskRole } from '../middleware/requireDeskRole.js';
import { CARRIER_RETURNS } from '../utils/returns.js';

// The only route that needs a desk role, so it is the only one an ordinary caller cannot reach.
export const listCarrierReturns = defineRoute({
  filters: { method: 'GET', path: '/carriers/:carrierId/returns' },
  middleware: [requireDeskRole],
}).handle(async (request) => {
  const returnIds = CARRIER_RETURNS[request.path.carrierId];
  if (!returnIds) throw NotFound({ error: `Carrier ${request.path.carrierId} is not known` });

  logger.info({ message: 'Carrier returns listed', carrierId: request.path.carrierId, count: returnIds.length });

  return Ok({ carrierId: request.path.carrierId, returnIds });
});
