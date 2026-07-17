import type {
  AppSyncEventsOutgoingEvent,
  AppSyncEventsPublishResult,
  AppSyncEventsRequest,
} from '@lambda-event-router/appsync';
import { isObject, logger } from '@lambda-event-router/base';

// Activity without a body is rejected on its own, and the rest of the batch still broadcasts. That
// per-event error is how a publish handler reports a partial failure.
export async function recordTicketActivity({ events }: AppSyncEventsRequest): Promise<AppSyncEventsPublishResult> {
  const outgoing: AppSyncEventsOutgoingEvent[] = events.map(({ id, payload }) => {
    if (!isObject(payload) || typeof payload.body !== 'string') {
      logger.info({ message: 'Ticket activity rejected', eventId: id });
      return { id, error: 'Activity needs a body' };
    }

    logger.info({ message: 'Ticket activity recorded', eventId: id, author: payload.author });
    return { id, payload };
  });

  return { events: outgoing };
}
