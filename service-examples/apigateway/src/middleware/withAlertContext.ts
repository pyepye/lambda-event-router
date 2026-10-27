import type { WebSocketMiddleware } from '@latcher/apigateway';
import { logger } from '@latcher/base';

import type { TStockAlert } from '../utils/schemas.js';

// Middleware sees every event type, so the eventType check is what narrows the request to the one
// carrying a body. The schema validates that body before the chain runs, so the alert is typed here.
export const withAlertContext: WebSocketMiddleware<TStockAlert> = async (request, next) => {
  if (request.eventType === 'MESSAGE') {
    logger.info({
      message: 'Stock alert received',
      sku: request.body.sku,
    });
  }

  return next(request);
};
