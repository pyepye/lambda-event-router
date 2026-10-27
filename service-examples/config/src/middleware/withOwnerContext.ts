import { logger } from '@latcher/base';
import type { ConfigMiddleware } from '@latcher/config';

import { OWNER_TAG } from '../config.js';

// Route middleware for the on-call rota route: names the owning team before the handler runs. Only a
// full configuration item carries tags, so an oversized one logs no owner.
export const withOwnerContext: ConfigMiddleware = async (request, next) => {
  logger.info({
    message: 'Owner resolved',
    owner: request.configurationItem?.tags[OWNER_TAG],
  });
  return next(request);
};
