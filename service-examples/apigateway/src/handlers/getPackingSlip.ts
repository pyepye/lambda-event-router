import { defineRoute, NotFound } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { PACKING_SLIP_PNG } from '../utils/warehouse.js';

// A REST API sends the bytes only when the first type in the request's Accept header is one of its
// binary media types. Any other caller gets the base64 text.
export const getPackingSlip = defineRoute({
  filters: { method: 'GET', path: '/orders/:orderId/slip' },
  responseType: { type: 'binary', contentType: 'image/png' },
}).handle(async (request) => {
  const slip = PACKING_SLIP_PNG[request.path.orderId];
  if (!slip) throw NotFound(`Order ${request.path.orderId} has no packing slip`);

  logger.info({ message: 'Packing slip read', orderId: request.path.orderId, bytes: slip.length });

  return slip;
});
