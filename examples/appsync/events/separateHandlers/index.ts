import type { Handler } from 'aws-lambda';

import { createAppSyncEventsRouter } from '@lambda-event-router/appsync';
import { LambdaRouter } from '@lambda-event-router/base';

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
    operation: 'PUBLISH',
    channelNamespace: '/default/*',
    custom: isChatChannel,
  },
  handler: onPublish,
});

const lambdaRouter = new LambdaRouter({
  routers: [appSyncEventsRouter],
});

export const handler: Handler = lambdaRouter.handler();
