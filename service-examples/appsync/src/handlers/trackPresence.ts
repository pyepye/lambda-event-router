import type { AppSyncEventsPublishResult } from '@lambda-event-router/appsync';
import { defineEventsRoute } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';
import { PRESENCE_NAMESPACE } from '../utils/constants.js';

// One route for both operations on the presence namespace: joining a desk is a subscribe, and a
// heartbeat is a publish. The namespace filter catches every channel under it, whatever the path.
export const trackPresence = defineEventsRoute({
  filters: {
    channelNamespace: PRESENCE_NAMESPACE,
    operation: ['PUBLISH', 'SUBSCRIBE'],
  },
}).handle(async ({ operation, channelPath, events }): Promise<AppSyncEventsPublishResult | null> => {
  if (operation === 'SUBSCRIBE') {
    logger.info({ message: 'Desk joined presence', channelPath });
    return null;
  }

  const outgoing = events.map(({ id, payload }) => ({ id, payload }));

  logger.info({ message: 'Presence heartbeat recorded', channelPath, count: outgoing.length });

  return { events: outgoing };
});
