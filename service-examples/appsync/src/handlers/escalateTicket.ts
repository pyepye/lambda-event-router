import type { AppSyncResolverRequest } from '@lambda-event-router/appsync';

import type { TTicketId } from '../utils/schemas.js';

// Escalation always throws, which is the only resolver here that fails inside the handler rather
// than on its schema. The middleware chain has already run by the time it does, so this field has a
// `Handling resolver request` line. A field that fails validation has none.
export async function escalateTicket({ arguments: args }: AppSyncResolverRequest<TTicketId>): Promise<never> {
  throw new Error(`Escalation queue unavailable for ${args.id}`);
}
