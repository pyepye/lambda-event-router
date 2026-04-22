import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createConfigScheduledRouter } from '@lambda-event-router/config';

import { crossAccountRoute, tagAuditRoute } from './routes.js';

const configScheduledRouter = createConfigScheduledRouter();

configScheduledRouter.route(tagAuditRoute).route(crossAccountRoute);

const lambdaRouter = new LambdaRouter({
  routers: [configScheduledRouter],
});

export const handler: Handler = lambdaRouter.handler();
