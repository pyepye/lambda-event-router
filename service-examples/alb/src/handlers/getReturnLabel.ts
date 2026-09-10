import { defineRoute, NotFound } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURN_LABEL_PNG } from '../utils/returns.js';

// A binary route base64 encodes the bytes and sets `isBase64Encoded`, which is what ALB needs to send
// the image back as the bytes the handler built.
export const getReturnLabel = defineRoute({
  filters: { method: 'GET', path: '/returns/:returnId/label' },
  responseType: { type: 'binary', contentType: 'image/png' },
}).handle(async (request) => {
  const label = RETURN_LABEL_PNG[request.path.returnId];
  if (!label) throw NotFound(`Return ${request.path.returnId} has no label`);

  logger.info({ message: 'Return label read', returnId: request.path.returnId, bytes: label.length });

  return label;
});
