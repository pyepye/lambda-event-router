import { createAppSyncEventsRouter } from '@lambda-event-router/appsync';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { onPublishRoute } from './onPublish.js';
import { onSubscribeRoute } from './onSubscribe.js';

const appSyncEventsRouter = createAppSyncEventsRouter();

appSyncEventsRouter.route(onPublishRoute).route(onSubscribeRoute);

const eventRouter = new EventRouter({
  routers: [appSyncEventsRouter],
});

export const handler: Handler = eventRouter.handler();
