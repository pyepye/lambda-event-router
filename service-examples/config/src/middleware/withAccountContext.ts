import { logger } from '@latcher/base';
import type { ConfigScheduledMiddleware } from '@latcher/config';

import type { TLambdaInventoryParameters } from '../utils/schemas.js';

// Route middleware for the inventory route. Typed to that route's parameters so it slots onto
// recordFunctionInventory without widening it.
export const withAccountContext: ConfigScheduledMiddleware<TLambdaInventoryParameters> = async (request, next) => {
  logger.info({
    message: 'Account context resolved',
    accountId: request.accountId,
    maxFunctions: request.ruleParameters.maxFunctions,
  });
  return next(request);
};
