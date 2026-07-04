import { createAppSyncRouter } from '@lambda-event-router/appsync';

import { createTicket } from './handlers/createTicket.js';
import { escalateTicket } from './handlers/escalateTicket.js';
import { getTicketForAgent, isAgent } from './handlers/getTicketForAgent.js';
import { getTicketForCustomer } from './handlers/getTicketForCustomer.js';
import { listWorkItems } from './handlers/listWorkItems.js';
import { resolveTicketComments } from './handlers/resolveTicketComments.js';
import { watchTicketCreated } from './handlers/watchTicketCreated.js';
import { logResolverRequest } from './middleware/logResolverRequest.js';
import { withTicketContext } from './middleware/withTicketContext.js';
import { NewTicketSchema, TicketIdSchema } from './utils/schemas.js';

export const resolverRouter = createAppSyncRouter({
  middleware: [logResolverRequest],
  batchItemFailures: true,
});

// Order matters: both `getTicket` routes match the same field, so the agent route is registered
// first and its custom filter decides. The customer route takes everyone else.
// `Mutation.closeTicket` has a resolver on the API and no route here, which is how a caller reaches
// the router's no-route error.
resolverRouter
  .query({
    fieldName: 'getTicket',
    filters: { custom: isAgent },
    argumentsSchema: TicketIdSchema,
    middleware: [withTicketContext],
    handler: getTicketForAgent,
  })
  .query({ fieldName: 'getTicket', argumentsSchema: TicketIdSchema, handler: getTicketForCustomer })
  .mutation({ fieldName: 'createTicket', argumentsSchema: NewTicketSchema, handler: createTicket })
  .mutation({ fieldName: 'escalateTicket', argumentsSchema: TicketIdSchema, handler: escalateTicket })
  .subscription({ fieldName: 'onTicketCreated', handler: watchTicketCreated })
  .route(listWorkItems)
  .route(resolveTicketComments);
