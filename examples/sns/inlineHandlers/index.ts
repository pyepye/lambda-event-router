import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createSNSRouter } from '@lambda-event-router/sns';

import { createItemRoute, urgentNotificationRoute } from './createItem.js';

const snsRouter = createSNSRouter();

snsRouter.route(createItemRoute).route(urgentNotificationRoute);

const lambdaRouter = new LambdaRouter({
  routers: [snsRouter],
});

export const handler: Handler = lambdaRouter.handler();
