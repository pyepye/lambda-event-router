import { EventRouter } from '@lambda-event-router/base';
import { createKinesisRouter } from '@lambda-event-router/kinesis';
import type { Handler } from 'aws-lambda';

import { highPriorityRoute } from './handlers/highPriorityRoute.js';
import { inventoryRoute } from './handlers/inventoryRoute.js';
import { orderRoute } from './handlers/orderRoute.js';

const kinesisRouter = createKinesisRouter({
  batchItemFailures: true,
});

kinesisRouter.route(orderRoute).route(inventoryRoute).route(highPriorityRoute);

const eventRouter = new EventRouter({
  routers: [kinesisRouter],
});

export const handler: Handler = eventRouter.handler();
