import { EventRouter } from '@lambda-event-router/base';
import { createSQSRouter } from '@lambda-event-router/sqs';
import type { Handler } from 'aws-lambda';

import { createItemRoute, highValueOrderRoute } from './createItem.js';

const sqsRouter = createSQSRouter(); // Defaults to batchItemFailures: false

sqsRouter.route(createItemRoute).route(highValueOrderRoute);

const eventRouter = new EventRouter({
  routers: [sqsRouter],
});

export const handler: Handler = eventRouter.handler();
