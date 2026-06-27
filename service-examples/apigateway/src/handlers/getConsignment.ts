import { defineRoute, NotFound, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { CONSIGNMENTS } from '../utils/warehouse.js';

// An HTTP API route on payload format 1.0, so the same adapter normalises it as a REST API request
// and the multi-value maps are populated.
export const getConsignment = defineRoute({
  filters: { method: 'GET', path: '/dispatch/:consignmentId' },
}).handle(async (request) => {
  const consignment = CONSIGNMENTS[request.path.consignmentId];
  if (!consignment) throw NotFound({ error: `Consignment ${request.path.consignmentId} does not exist` });

  logger.info({
    message: 'Consignment read',
    consignmentId: consignment.consignmentId,
    depots: request.multiValueQuery.depot,
    query: request.query,
  });

  return Ok(consignment);
});
