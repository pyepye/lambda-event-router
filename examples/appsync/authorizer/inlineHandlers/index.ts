import { createAppSyncAuthorizerRouter } from '@lambda-event-router/appsync';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { onAuthRoute } from './onAuth.js';

const appSyncAuthorizerRouter = createAppSyncAuthorizerRouter();

appSyncAuthorizerRouter.route(onAuthRoute);

const eventRouter = new EventRouter({
  routers: [appSyncAuthorizerRouter],
});

export const handler: Handler = eventRouter.handler();
