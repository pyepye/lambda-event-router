import { createAppSyncEventsAuthorizerRouter } from '@lambda-event-router/appsync';

import {
  admitActivityConnection,
  admitPresenceWatcher,
  authoriseTicketActivity,
  isKnownToken,
  refuseUnknownConnection,
} from './handlers/authoriseActivityAccess.js';
import { refuseAuditAccess } from './handlers/refuseAuditAccess.js';
import { logChannelAuthorisation } from './middleware/logChannelAuthorisation.js';
import { PRESENCE_CHANNEL_PATTERN, TICKET_CHANNEL_PATTERN } from './utils/constants.js';

export const eventsAuthorizerRouter = createAppSyncEventsAuthorizerRouter({
  middleware: [logChannelAuthorisation],
});

// Order matters: both connect routes match every connect, so the custom filter is asked first and
// an unknown token falls through to the refusal.
// Nothing authorises a subscribe to a ticket channel, which is how a caller reaches the router's
// no-route error.
eventsAuthorizerRouter
  .connect({ filters: { custom: isKnownToken }, handler: admitActivityConnection })
  .connect({ handler: refuseUnknownConnection })
  .publish({ channelPath: TICKET_CHANNEL_PATTERN, handler: authoriseTicketActivity })
  .subscribe({ channelPath: PRESENCE_CHANNEL_PATTERN, handler: admitPresenceWatcher })
  .route(refuseAuditAccess);
