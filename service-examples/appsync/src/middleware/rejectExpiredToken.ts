import type { AppSyncAuthorizerMiddleware } from '@latcher/appsync';
import { Denied } from '@latcher/appsync';
import { logger } from '@latcher/base';

import { EXPIRED_TOKEN } from '../utils/constants.js';

// Route middleware that stops an expired token before the handler runs. Throwing a response rather
// than returning one reaches the caller unchanged: the matcher recognises it and hands it back as
// the authorizer's answer.
export const rejectExpiredToken: AppSyncAuthorizerMiddleware = async (request, next) => {
  if (request.authorizationToken === EXPIRED_TOKEN) {
    logger.info({ message: 'Token expired', token: request.authorizationToken });
    throw Denied({ ttlOverride: 0 });
  }

  return next(request);
};
