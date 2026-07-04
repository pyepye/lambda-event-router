import type { AppSyncEventsRequest } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

import { activityEvents, type OutgoingEvent, type PublishResponse } from '../utils/activity.js';

// Activity without a body is rejected on its own, and the rest of the batch still broadcasts. That
// per-event error is how a publish handler reports a partial failure.
export async function recordTicketActivity({ events }: AppSyncEventsRequest): Promise<PublishResponse> {
  const outgoing: OutgoingEvent[] = activityEvents(events).map(({ id, payload }) => {
    if (typeof payload.body !== 'string') {
      logger.info({ message: 'Ticket activity rejected', eventId: id });
      return { id, error: 'Activity needs a body' };
    }

    logger.info({ message: 'Ticket activity recorded', eventId: id, author: payload.author });
    return { id, payload };
  });

  return { events: outgoing };
}
