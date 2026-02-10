import { createAPIGatewayRouter } from '@lambda-event-router/apigateway';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { createItemRoute } from './createItem.js';

const apiRouter = createAPIGatewayRouter();

apiRouter.route(createItemRoute);

const eventRouter = new EventRouter({
  routers: [apiRouter],
});

export const handler: Handler = eventRouter.handler();
