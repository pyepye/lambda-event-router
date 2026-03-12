import { createAppSyncAuthorizerRouter } from '@lambda-event-router/appsync';
import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { onAuth } from './onAuth.js';

const appSyncAuthorizerRouter = createAppSyncAuthorizerRouter();

appSyncAuthorizerRouter.route({
  handler: onAuth,
});

const lambdaRouter = new LambdaRouter({
  routers: [appSyncAuthorizerRouter],
});

export const handler: Handler = lambdaRouter.handler();
