import { EventRouter } from '@lambda-event-router/base';
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge';
import type { Handler } from 'aws-lambda';

import {
  ec2StateChangeRoute,
  orderCreatedRoute,
  orderUpdatedRoute,
  scheduledRuleRoute,
} from './handlers/eventRoutes.js';

const eventBridgeRouter = createEventBridgeRouter();

eventBridgeRouter
  .route(ec2StateChangeRoute)
  .route(orderCreatedRoute)
  .route(orderUpdatedRoute)
  .route(scheduledRuleRoute);

const eventRouter = new EventRouter({
  routers: [eventBridgeRouter],
});

export const handler: Handler = eventRouter.handler();
