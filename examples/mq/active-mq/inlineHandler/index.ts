import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';

import { createActiveMQRouter } from '../../../../packages/mq/src/index.js';
import { allMessagesRoute } from './handlers/allMessagesRoute.js';
import { bytesMessageRoute } from './handlers/bytesMessageRoute.js';
import { destinationRoute } from './handlers/destinationRoute.js';
import { orderRoute, priorityOrderRoute } from './handlers/orderRoute.js';
import { textMessageRoute } from './handlers/textMessageRoute.js';

const activeMQRouter = createActiveMQRouter();

activeMQRouter
  .route(allMessagesRoute)
  .route(textMessageRoute)
  .route(bytesMessageRoute)
  .route(destinationRoute)
  .route(orderRoute)
  .route(priorityOrderRoute);

const lambdaRouter = new LambdaRouter({
  routers: [activeMQRouter],
});

export const handler: Handler = lambdaRouter.handler();
