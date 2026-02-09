import { EventRouter } from '@lambda-event-router/base';
import { createCloudWatchLogsRouter } from '@lambda-event-router/cloudwatch';
import type { Handler } from 'aws-lambda';

import {
  alertSubscriptionRoute,
  allLambdaLogsRoute,
  apiGatewayLogsRoute,
  ecsServiceLogsRoute,
  highVolumeRoute,
  lambdaErrorLogsRoute,
} from './handlers/logRoutes.js';

const cloudWatchLogsRouter = createCloudWatchLogsRouter();

// Generic .route() with filters
cloudWatchLogsRouter
  .route(lambdaErrorLogsRoute)
  .route(allLambdaLogsRoute)
  .route(alertSubscriptionRoute)
  .route(ecsServiceLogsRoute)
  .route(apiGatewayLogsRoute)
  .route(highVolumeRoute);

const eventRouter = new EventRouter({
  routers: [cloudWatchLogsRouter],
});

export const handler: Handler = eventRouter.handler();
