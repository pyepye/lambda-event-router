import { createAppSyncEventsRouter } from '@lambda-event-router/appsync';

import { admitTicketWatcher } from './handlers/admitTicketWatcher.js';
import { archiveAuditEntry } from './handlers/archiveAuditEntry.js';
import { holdTypingNotice, isTypingBatch } from './handlers/holdTypingNotice.js';
import { probeEvents } from './handlers/probeEvents.js';
import { recordTicketActivity } from './handlers/recordTicketActivity.js';
import { trackPresence } from './handlers/trackPresence.js';
import { logEventsRequest } from './middleware/logEventsRequest.js';
import { withChannelContext } from './middleware/withChannelContext.js';
import { TICKET_CHANNEL_PATTERN } from './utils/constants.js';

export const eventsRouter = createAppSyncEventsRouter({ middleware: [logEventsRequest] });

// Order matters: both publish routes cover the ticket channels, so the typing filter is asked first
// and a batch of typing notices never reaches the route that stores activity.
eventsRouter
  .publish({ channelPath: TICKET_CHANNEL_PATTERN, filters: { custom: isTypingBatch }, handler: holdTypingNotice })
  .publish({ channelPath: TICKET_CHANNEL_PATTERN, middleware: [withChannelContext], handler: recordTicketActivity })
  .subscribe({ channelPath: TICKET_CHANNEL_PATTERN, handler: admitTicketWatcher })
  .route(trackPresence)
  .route(archiveAuditEntry)
  .route(probeEvents);
