import { LambdaRouter } from '@lambda-event-router/base';
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge';
import type { Handler } from 'aws-lambda';

import {
  codeBuildStateChangeRoute,
  ec2StateChangeRoute,
  iamPolicyChangeRoute,
  orderCreatedRoute,
  orderUpdatedRoute,
  pipesOrderReceivedRoute,
  scheduledRuleRoute,
} from './handlers/eventRoutes.js';

const eventBridgeRouter = createEventBridgeRouter();

eventBridgeRouter
  .route(ec2StateChangeRoute)
  .route(orderCreatedRoute)
  .route(orderUpdatedRoute)
  .route(scheduledRuleRoute)
  .route(iamPolicyChangeRoute)
  .route(pipesOrderReceivedRoute)
  .route(codeBuildStateChangeRoute);

const lambdaRouter = new LambdaRouter({
  routers: [eventBridgeRouter],
});

export const handler: Handler = lambdaRouter.handler();
