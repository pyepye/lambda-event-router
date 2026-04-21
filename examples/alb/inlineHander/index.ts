import { createALBRouter } from '@lambda-event-router/alb';
import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { createItemRoute } from './createItem.js';
import { updateItemRoute } from './updateItem.js';

const apiRouter = createALBRouter();

apiRouter.route(createItemRoute).route(updateItemRoute);

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter],
});

export const handler: Handler = lambdaRouter.handler();
