import type { Handler } from 'aws-lambda';

import { createAppSyncAuthorizerRouter } from '@lambda-event-router/appsync';
import { LambdaRouter } from '@lambda-event-router/base';

import { onAuthRoute } from './onAuth.js';

const appSyncAuthorizerRouter = createAppSyncAuthorizerRouter();

appSyncAuthorizerRouter.route(onAuthRoute);

const lambdaRouter = new LambdaRouter({
  routers: [appSyncAuthorizerRouter],
});

export const handler: Handler = lambdaRouter.handler();
