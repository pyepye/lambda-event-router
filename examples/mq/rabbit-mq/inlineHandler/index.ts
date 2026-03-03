import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';
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

const eventRouter = new EventRouter({
  routers: [rabbitMQRouter],
});

export const handler: Handler = eventRouter.handler();
