import { logger } from '@latcher/base';
import type { ConnectMiddleware } from '@latcher/connect';

import { STEP_PARAMETER } from '../utils/constants.js';

// Matcher middleware: runs once per matched contact, before any route middleware.
export const logContact: ConnectMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling Connect contact',
    contactId: request.contactData.ContactId,
    channel: request.contactData.Channel,
    initiationMethod: request.contactData.InitiationMethod,
    step: request.parameters[STEP_PARAMETER],
    requestId: request.context.awsRequestId,
  });
  return next(request);
};
