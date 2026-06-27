import type { WebSocketMiddleware } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import type { TStockAlert } from '../utils/schemas.js';

// Route middleware on the sendAlert route: the body is validated before the chain runs, so the
// alert is typed here.
export const withAlertContext: WebSocketMiddleware<TStockAlert> = async (request, next) => {
  logger.info({
    message: 'Stock alert received',
    sku: request.body.sku,
  });

  return next(request);
};
