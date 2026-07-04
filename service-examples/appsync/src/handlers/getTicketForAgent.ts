import type { AppSyncResolverFilterInput, AppSyncResolverRequest } from '@lambda-event-router/appsync';
import { isObject, logger } from '@lambda-event-router/base';

import { AGENT_ROLE } from '../utils/constants.js';
import type { TTicketId } from '../utils/schemas.js';
import { findTicket, type Ticket } from '../utils/supportDesk.js';

// The role comes from the authorizer's `resolverContext`, which AppSync copies onto `identity`.
export function isAgent({ event }: AppSyncResolverFilterInput): boolean {
  const resolverContext = isObject(event.identity) ? event.identity.resolverContext : undefined;

  return isObject(resolverContext) && resolverContext.role === AGENT_ROLE;
}

export async function getTicketForAgent({
  arguments: args,
}: AppSyncResolverRequest<TTicketId>): Promise<Ticket | null> {
  const ticket = findTicket(args.id);

  logger.info({ message: 'Ticket read by agent', ticketId: args.id, found: Boolean(ticket) });

  return ticket ?? null;
}
