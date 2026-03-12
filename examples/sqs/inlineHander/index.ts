import { LambdaRouter } from '@lambda-event-router/base';
import { createSQSRouter } from '@lambda-event-router/sqs';
import type { Handler } from 'aws-lambda';

import { createItemRoute, highValueOrderRoute } from './createItem.js';

const sqsRouter = createSQSRouter(); // Defaults to batchItemFailures: false

sqsRouter.route(createItemRoute).route(highValueOrderRoute);

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter],
});

export const handler: Handler = lambdaRouter.handler();
