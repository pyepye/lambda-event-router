import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createFirehoseRouter } from '@lambda-event-router/firehose';

import { enrichRoute } from './handlers/enrichRoute.js';
import { filterRoute } from './handlers/filterRoute.js';
import { formatRoute } from './handlers/formatRoute.js';

const firehoseRouter = createFirehoseRouter();

firehoseRouter.route(enrichRoute).route(filterRoute).route(formatRoute);

const lambdaRouter = new LambdaRouter({
  routers: [firehoseRouter],
});

export const handler: Handler = lambdaRouter.handler();
