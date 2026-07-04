import type { AppSyncAuthorizerRequest, AppSyncAuthorizerResponse } from '@lambda-event-router/appsync';
import { Authorized, Denied } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

import { BROKEN_TOKEN, TOKEN_GRANTS } from '../utils/constants.js';

// Every response overrides the cache to 0 seconds, so a repeat request is authorised again rather
// than served from the cache.
export async function authoriseSupportToken({
  authorizationToken,
}: AppSyncAuthorizerRequest): Promise<AppSyncAuthorizerResponse> {
  if (authorizationToken === BROKEN_TOKEN) {
    throw new Error(`Token store unreachable for ${authorizationToken}`);
  }

  const grant = TOKEN_GRANTS[authorizationToken];
  if (!grant) {
    logger.info({ message: 'Token refused', token: authorizationToken });
    return Denied({ ttlOverride: 0 });
  }

  logger.info({ message: 'Token accepted', token: authorizationToken, role: grant.role });

  return Authorized({
    resolverContext: { role: grant.role, actorId: grant.actorId },
    ...(grant.deniedFields && { deniedFields: grant.deniedFields }),
    ttlOverride: 0,
  });
}
