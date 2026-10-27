import type { AppSyncEventsRequest } from '@latcher/appsync';
import { logger } from '@latcher/base';

// Returning null admits the subscriber. Throwing would refuse it.
export async function admitTicketWatcher({ channelPath }: AppSyncEventsRequest): Promise<null> {
  logger.info({ message: 'Ticket watcher admitted', channelPath });

  return null;
}
