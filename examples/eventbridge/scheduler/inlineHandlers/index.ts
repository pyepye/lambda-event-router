import { LambdaRouter } from '@lambda-event-router/base';
import { createEventBridgeSchedulerRouter } from '@lambda-event-router/eventbridge';
import type { Handler } from 'aws-lambda';

import { dailyCleanupRoute, weeklyReportRoute } from './handlers/eventRoutes.js';

const schedulerRouter = createEventBridgeSchedulerRouter();

schedulerRouter.route(dailyCleanupRoute).route(weeklyReportRoute);

const lambdaRouter = new LambdaRouter({
  routers: [schedulerRouter],
});

export const handler: Handler = lambdaRouter.handler();
