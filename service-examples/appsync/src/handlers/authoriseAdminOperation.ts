import type { AppSyncAuthorizerFilterInput, AppSyncAuthorizerRequest } from '@lambda-event-router/appsync';
import { Authorized, Denied } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

import { AGENT_ROLE, TOKEN_GRANTS } from '../utils/constants.js';

// Only an agent takes the admin route. A customer naming the same operation falls through to the
// route below it and is held to the ordinary grant.
export function isAgentToken({ event }: AppSyncAuthorizerFilterInput): boolean {
  return TOKEN_GRANTS[event.authorizationToken]?.role === AGENT_ROLE;
}

export async function authoriseAdminOperation({ authorizationToken, operationName }: AppSyncAuthorizerRequest) {
  const grant = TOKEN_GRANTS[authorizationToken];
  if (!grant) return Denied({ ttlOverride: 0 });

  logger.info({ message: 'Admin operation authorised', operationName, token: authorizationToken });

  return Authorized({
    resolverContext: { role: grant.role, actorId: grant.actorId, admin: 'true' },
    ttlOverride: 0,
  });
}
