import { defineRoute, NotFound, Ok } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURN_LABEL_PNG } from '../utils/returns.js';

// Returns bytes rather than text. The router base64 encodes the buffer and sets `isBase64Encoded`,
// which is what ALB needs to send the image back as the bytes the handler built.
export const getReturnLabel = defineRoute({
  filters: { method: 'GET', path: '/returns/:returnId/label' },
}).handle(async (request) => {
  const label = RETURN_LABEL_PNG[request.path.returnId];
  if (!label) throw NotFound({ error: `Return ${request.path.returnId} has no label` });

  logger.info({ message: 'Return label read', returnId: request.path.returnId, bytes: label.length });

  return Ok(label, { 'content-type': 'image/png' });
});
