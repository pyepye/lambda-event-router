import { createEventRouter, LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { dailyCleanupRoute, weeklyReportRoute } from './handlers/eventRoutes.js';

const genericRouter = createEventRouter();

genericRouter.route(dailyCleanupRoute).route(weeklyReportRoute);

const lambdaRouter = new LambdaRouter({
  routers: [genericRouter],
});

export const handler: Handler = lambdaRouter.handler();
