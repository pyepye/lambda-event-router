import type { AppSyncResolverRequest } from '@latcher/appsync';
import { isObject, logger } from '@latcher/base';

// AppSync runs a subscription's resolver when a client subscribes, not when an event arrives.
// Returning null accepts the subscription.
export async function watchTicketCreated({ identity }: AppSyncResolverRequest): Promise<null> {
  const resolverContext = isObject(identity) ? identity.resolverContext : undefined;

  logger.info({
    message: 'Ticket feed subscription opened',
    role: isObject(resolverContext) ? resolverContext.role : undefined,
  });

  return null;
}
