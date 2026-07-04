import type { AppSyncResolverRequest } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

import type { TNewTicket } from '../utils/schemas.js';
import { raiseTicket, type Ticket } from '../utils/supportDesk.js';

export async function createTicket({ arguments: args }: AppSyncResolverRequest<TNewTicket>): Promise<Ticket> {
  const ticket = raiseTicket(args.subject, args.priority);

  logger.info({ message: 'Ticket created', ticketId: ticket.id, priority: ticket.priority });

  return ticket;
}
