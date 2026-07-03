import { BinaryBody, defineRoute, NotFound, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { ORDERS } from '../utils/warehouse.js';

// A manifest is uploaded as binary rather than JSON. API Gateway base64 encodes a body whose content
// type is one of the API's binary media types, and the router decodes it to the bytes that were sent.
export const uploadOrderManifest = defineRoute({
  filters: { method: 'PUT', path: '/orders/:orderId/manifest' },
  bodySchema: BinaryBody,
}).handle(async (request) => {
  const order = ORDERS[request.path.orderId];
  if (!order) throw NotFound({ error: `Order ${request.path.orderId} does not exist` });

  const manifest = request.body.toString('utf-8');
  const lines = manifest.split('\n').filter((line) => line.length > 0);

  logger.info({
    message: 'Order manifest uploaded',
    orderId: order.orderId,
    lines: lines.length,
    bytes: request.body.length,
    isBase64Encoded: request.isBase64Encoded,
  });

  return Ok({ orderId: order.orderId, lines: lines.length });
});
