import type { AppSyncEventsPublishResult } from '@lambda-event-router/appsync';
import { defineEventsRoute } from '@lambda-event-router/appsync';
import { isObject, logger } from '@lambda-event-router/base';

import { AUDIT_NAMESPACE } from '../utils/constants.js';

// An audit entry with no actor is unusable, so the whole publish fails rather than storing part of
// it. The namespace has a subscribe handler wired to this worker and no subscribe route, so a
// client that tries to listen to the trail is turned away by the router.
export const archiveAuditEntry = defineEventsRoute({
  filters: {
    channelNamespace: AUDIT_NAMESPACE,
    operation: 'PUBLISH',
  },
}).handle(async ({ events }): Promise<AppSyncEventsPublishResult> => {
  for (const { id, payload } of events) {
    if (!isObject(payload) || typeof payload.actor !== 'string') {
      throw new Error(`Audit entry ${id} names no actor`);
    }
    logger.info({ message: 'Audit entry archived', eventId: id, actor: payload.actor });
  }

  return { events: events.map(({ id, payload }) => ({ id, payload })) };
});
