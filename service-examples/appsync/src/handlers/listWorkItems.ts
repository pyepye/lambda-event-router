import { defineRoute } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

import { listQueues, listTickets } from '../utils/supportDesk.js';

// One resolver behind both list fields. The wildcard field name is what makes that possible, and
// `info.fieldName` is what tells them apart.
export const listWorkItems = defineRoute({
  filters: {
    parentTypeName: 'Query',
    fieldName: 'list*',
  },
}).handle(async ({ info, arguments: args }) => {
  if (info.fieldName === 'listQueues') {
    logger.info({ message: 'Queues listed' });
    return listQueues();
  }

  const status = typeof args.status === 'string' ? args.status : undefined;
  const tickets = listTickets(status);

  logger.info({ message: 'Tickets listed', status, count: tickets.length });

  return tickets;
});
