import { createAppSyncAuthorizerRouter } from '@lambda-event-router/appsync';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { onAuth } from './onAuth.js';

const appSyncAuthorizerRouter = createAppSyncAuthorizerRouter();

appSyncAuthorizerRouter.route({
  handler: onAuth,
});

const eventRouter = new EventRouter({
  routers: [appSyncAuthorizerRouter],
});

export const handler: Handler = eventRouter.handler();
