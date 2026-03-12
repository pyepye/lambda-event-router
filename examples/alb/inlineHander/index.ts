import { createALBRouter } from '@lambda-event-router/alb';
import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { createItemRoute } from './createItem.js';

const apiRouter = createALBRouter();

apiRouter.route(createItemRoute);

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter],
});

export const handler: Handler = lambdaRouter.handler();
