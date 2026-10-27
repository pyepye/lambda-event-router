import { defineWebSocketRoute, postToConnection } from '@latcher/apigateway';
import { logger } from '@latcher/base';

import { ADMIN_ROUTE_KEY_PREFIX } from '../utils/constants.js';

// Admin route keys share a prefix, so one route covers all of them. Only defineWebSocketRoute takes
// a custom filter.
export const runAdminCommand = defineWebSocketRoute({
  filters: {
    eventType: 'MESSAGE',
    custom: ({ routeKey }) => routeKey.startsWith(ADMIN_ROUTE_KEY_PREFIX),
  },
}).handle(async ({ connectionId, domainName, stage, routeKey }) => {
  logger.info({ message: 'Admin command run', routeKey, connectionId });

  await postToConnection({
    domainName,
    stage,
    connectionId,
    data: JSON.stringify({ command: routeKey, status: 'accepted' }),
  });
});
