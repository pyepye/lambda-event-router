import { EventRouter } from '@lambda-event-router/base';
import { createVPCLatticeRouter } from '@lambda-event-router/vpclattice';
import type { Handler } from 'aws-lambda';

import { createItemRoute } from './createItem.js';

const apiRouter = createVPCLatticeRouter();

apiRouter.route(createItemRoute);

const eventRouter = new EventRouter({
  routers: [apiRouter],
});

export const handler: Handler = eventRouter.handler();
