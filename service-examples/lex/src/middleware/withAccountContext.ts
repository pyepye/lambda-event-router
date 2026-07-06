import { logger } from '@lambda-event-router/base';
import type { LexMiddleware } from '@lambda-event-router/lex';

import { ACCOUNT_TIER_ATTRIBUTE } from '../utils/constants.js';

// Route middleware for the escalation route: tags the log with the tier its custom filter matched on.
export const withAccountContext: LexMiddleware = async (request, next) => {
  logger.info({
    message: 'Priority account turn',
    accountTier: request.sessionAttributes[ACCOUNT_TIER_ATTRIBUTE],
  });
  return next(request);
};
