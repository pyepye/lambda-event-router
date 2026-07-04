import type { AppSyncResolverRequest } from '@lambda-event-router/appsync';
import { isObject, logger } from '@lambda-event-router/base';

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
