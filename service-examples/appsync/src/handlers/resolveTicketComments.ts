import { defineRoute } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

import { commentsFor, findTicket } from '../utils/supportDesk.js';

// A field resolver on the Ticket type, batched by `maxBatchSize` on the resolver. The ticket the
// comments belong to arrives as `source`, which is the parent field's result rather than the
// caller's arguments. A closed ticket's comments live in the archive, so this throws for one.
export const resolveTicketComments = defineRoute({
  filters: {
    parentTypeName: 'Ticket',
    fieldName: 'comments',
  },
}).handle(async ({ source }) => {
  const ticketId = typeof source?.id === 'string' ? source.id : '';

  if (findTicket(ticketId)?.status === 'closed') {
    throw new Error(`Comments for ${ticketId} are archived`);
  }

  const comments = commentsFor(ticketId);

  logger.info({ message: 'Ticket comments resolved', ticketId, count: comments.length });

  return comments;
});
