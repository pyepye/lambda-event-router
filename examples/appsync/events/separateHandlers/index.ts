import { createAppSyncEventsRouter } from '@lambda-event-router/appsync';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { isChatChannel, onPublish } from './onPublish.js';
import { onSubscribe } from './onSubscribe.js';

const appSyncEventsRouter = createAppSyncEventsRouter();

// Convenience methods for common operations
appSyncEventsRouter.publish({
  channelNamespace: '/default/*',
  handler: onPublish,
});

appSyncEventsRouter.subscribe({
  channelNamespace: '/default/*',
  handler: onSubscribe,
});

appSyncEventsRouter.route({
  filters: {
    operations: ['PUBLISH'],
    channelNamespaces: ['/default/*'],
    customFilter: isChatChannel,
  },
  handler: onPublish,
});

const eventRouter = new EventRouter({
  routers: [appSyncEventsRouter],
});

export const handler: Handler = eventRouter.handler();
