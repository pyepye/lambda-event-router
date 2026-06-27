import { defineRoute, NotFound, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { ORDERS } from '../utils/warehouse.js';

// A manifest is uploaded as binary rather than JSON. API Gateway base64 encodes a body whose content
// type is one of the API's binary media types, and the router decodes it before the handler sees it.
export const uploadOrderManifest = defineRoute({
  filters: { method: 'PUT', path: '/orders/:orderId/manifest' },
}).handle(async (request) => {
  const order = ORDERS[request.path.orderId];
  if (!order) throw NotFound({ error: `Order ${request.path.orderId} does not exist` });

  const manifest = typeof request.body === 'string' ? request.body : '';
  const lines = manifest.split('\n').filter((line) => line.length > 0);
  const { isBase64Encoded } = request.event as { isBase64Encoded?: boolean };

  logger.info({
    message: 'Order manifest uploaded',
    orderId: order.orderId,
    lines: lines.length,
    isBase64Encoded,
  });

  return Ok({ orderId: order.orderId, lines: lines.length });
});
