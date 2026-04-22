import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';

import { createRabbitMQRouter } from '../../../../packages/mq/src/index.js';
import { allMessagesRoute } from './handlers/allMessagesRoute.js';
import { contentTypeRoute } from './handlers/contentTypeRoute.js';
import { orderRoute, retryOrderRoute } from './handlers/orderRoute.js';
import { queueRoute } from './handlers/queueRoute.js';

const rabbitMQRouter = createRabbitMQRouter();

rabbitMQRouter
  .route(allMessagesRoute)
  .route(queueRoute)
  .route(contentTypeRoute)
  .route(orderRoute)
  .route(retryOrderRoute);

const lambdaRouter = new LambdaRouter({
  routers: [rabbitMQRouter],
});

export const handler: Handler = lambdaRouter.handler();
