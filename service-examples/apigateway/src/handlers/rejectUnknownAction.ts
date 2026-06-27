import { defineWebSocketRoute, postToConnection } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

// The API's $default route collects any frame whose action it does not recognise.
export const rejectUnknownAction = defineWebSocketRoute({
  filters: { eventType: 'MESSAGE', routeKey: '$default' },
}).handle(async ({ connectionId, domainName, stage, event }) => {
  logger.info({ message: 'Unknown action rejected', connectionId, body: event.body });

  await postToConnection({
    domainName,
    stage,
    connectionId,
    data: JSON.stringify({ error: 'Unknown action' }),
  });
});
