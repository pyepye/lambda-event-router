import { createApiRouter } from '@lambda-event-router/api';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { createItemRoute } from './createItem.js';

const apiRouter = createApiRouter();

apiRouter.route(createItemRoute);

const eventRouter = new EventRouter({
  routers: [apiRouter],
});

export const handler: Handler = eventRouter.handler();
