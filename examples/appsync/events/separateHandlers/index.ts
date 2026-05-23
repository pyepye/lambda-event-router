import type { Handler } from 'aws-lambda';

import { createAppSyncEventsRouter } from '@lambda-event-router/appsync';
import { LambdaRouter } from '@lambda-event-router/base';

import { isChatChannel, onPublish } from './onPublish.js';
import { onSubscribe } from './onSubscribe.js';

const appSyncEventsRouter = createAppSyncEventsRouter();

// Convenience methods for common operations
appSyncEventsRouter.publish({
  channelPath: '/default/*',
  handler: onPublish,
});

appSyncEventsRouter.subscribe({
  channelPath: '/default/*',
  handler: onSubscribe,
});

appSyncEventsRouter.route({
  filters: {
    operation: 'PUBLISH',
    channelPath: '/default/*',
    custom: isChatChannel,
  },
  handler: onPublish,
});

const lambdaRouter = new LambdaRouter({
  routers: [appSyncEventsRouter],
});

export const handler: Handler = lambdaRouter.handler();
