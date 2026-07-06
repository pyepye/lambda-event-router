import { defineEventsAuthorizerRoute, EventsDenied } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

import { AUDIT_NAMESPACE } from '../utils/constants.js';

// The audit trail is written by the service and read by nobody, so the namespace filter turns away
// every operation on it whatever the token.
export const refuseAuditAccess = defineEventsAuthorizerRoute({
  filters: { channelNamespace: AUDIT_NAMESPACE },
}).handle(async ({ operation, channelPath }) => {
  logger.info({ message: 'Audit access refused', operation, channelPath });

  return EventsDenied({ ttlOverride: 0 });
});
