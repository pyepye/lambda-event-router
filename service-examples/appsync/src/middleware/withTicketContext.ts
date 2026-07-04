import type { AppSyncResolverMiddleware } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

import type { TTicketId } from '../utils/schemas.js';

// Route middleware for the agent read. Typed to the route's arguments so it slots onto the route
// without widening them.
export const withTicketContext: AppSyncResolverMiddleware<TTicketId> = async (request, next) => {
  logger.info({ message: 'Agent ticket lookup started', ticketId: request.arguments.id });
  return next(request);
};
