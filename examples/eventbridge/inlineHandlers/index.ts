import { EventRouter } from '@lambda-event-router/base';
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge';
import type { Handler } from 'aws-lambda';

import {
  dailyCleanupRoute,
  ec2StateChangeRoute,
  orderCreatedRoute,
  orderUpdatedRoute,
  scheduledRuleRoute,
  weeklyReportRoute,
} from './handlers/eventRoutes.js';

const eventBridgeRouter = createEventBridgeRouter();

// Standard EventBridge events (with source, detail-type envelope)
eventBridgeRouter
  .route(ec2StateChangeRoute)
  .route(orderCreatedRoute)
  .route(orderUpdatedRoute)
  .route(scheduledRuleRoute);

// EventBridge Scheduler events (custom payloads)
eventBridgeRouter.route(dailyCleanupRoute).route(weeklyReportRoute);

const eventRouter = new EventRouter({
  routers: [eventBridgeRouter],
});

export const handler: Handler = eventRouter.handler();
