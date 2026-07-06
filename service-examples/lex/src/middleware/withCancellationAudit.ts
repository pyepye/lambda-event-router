import { logger } from '@lambda-event-router/base';
import type { LexMiddleware } from '@lambda-event-router/lex';

import { TRACKING_NUMBER_SLOT } from '../utils/constants.js';

// Route middleware attached through defineRoute rather than through a route registration.
export const withCancellationAudit: LexMiddleware = async (request, next) => {
  logger.info({
    message: 'Cancellation requested',
    trackingNumber: request.slots[TRACKING_NUMBER_SLOT]?.value.interpretedValue,
    sessionId: request.event.sessionId,
  });
  return next(request);
};
