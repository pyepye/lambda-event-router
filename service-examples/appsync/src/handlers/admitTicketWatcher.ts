import type { AppSyncEventsRequest } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

// Returning null admits the subscriber. Throwing would refuse it.
export async function admitTicketWatcher({ channelPath }: AppSyncEventsRequest): Promise<null> {
  logger.info({ message: 'Ticket watcher admitted', channelPath });

  return null;
}
