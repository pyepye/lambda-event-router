import { createEventRouter, LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import {
  generateReportRoute,
  processOrderRoute,
  scheduledCleanupRoute,
  temperatureReadingRoute,
} from './handlers/eventRoutes.js';

const eventRouter = createEventRouter();

eventRouter
  .route(scheduledCleanupRoute)
  .route(processOrderRoute)
  .route(temperatureReadingRoute)
  .route(generateReportRoute);

const lambdaRouter = new LambdaRouter({
  routers: [eventRouter],
});

export const handler: Handler = lambdaRouter.handler();
