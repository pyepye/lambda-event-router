import { createALBRouter } from '@lambda-event-router/alb';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { createItemRoute } from './createItem.js';

const apiRouter = createALBRouter();

apiRouter.route(createItemRoute);

const eventRouter = new EventRouter({
  routers: [apiRouter],
});

export const handler: Handler = eventRouter.handler();
