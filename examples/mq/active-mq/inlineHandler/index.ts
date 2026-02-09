import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';
import { createActiveMQRouter } from '../../../../packages/mq/src/index.js';

import { allMessagesRoute } from './handlers/allMessagesRoute.js';
import { bytesMessageRoute } from './handlers/bytesMessageRoute.js';
import { destinationRoute } from './handlers/destinationRoute.js';
import { orderRoute } from './handlers/orderRoute.js';
import { textMessageRoute } from './handlers/textMessageRoute.js';

const activeMQRouter = createActiveMQRouter();

activeMQRouter
  .route(allMessagesRoute)
  .route(textMessageRoute)
  .route(bytesMessageRoute)
  .route(destinationRoute)
  .route(orderRoute);

const eventRouter = new EventRouter({
  routers: [activeMQRouter],
});

export const handler: Handler = eventRouter.handler();
