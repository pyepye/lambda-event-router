import { logger } from '@latcher/base';
import type { ConnectMiddleware } from '@latcher/connect';

import { ORDER_REF_PARAMETER } from '../utils/constants.js';

// Route middleware on the escalation route. It runs after logContact and only for that route.
export const withEscalationContext: ConnectMiddleware = async (request, next) => {
  logger.info({
    message: 'Priority contact received',
    contactId: request.contactData.ContactId,
    orderRef: request.parameters[ORDER_REF_PARAMETER],
  });
  return next(request);
};
