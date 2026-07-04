import type { AppSyncResolverRequest } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

import type { TTicketId } from '../utils/schemas.js';
import { findTicket, type Ticket } from '../utils/supportDesk.js';

// A customer sees the same ticket without the desk's private note.
export async function getTicketForCustomer({
  arguments: args,
}: AppSyncResolverRequest<TTicketId>): Promise<Ticket | null> {
  const ticket = findTicket(args.id);

  logger.info({ message: 'Ticket read by customer', ticketId: args.id, found: Boolean(ticket) });

  return ticket ? { ...ticket, internalNote: null } : null;
}
