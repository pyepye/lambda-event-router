import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createConfigRouter } from '@lambda-event-router/config';

import { elbListenerRoute, kmsKeyRotationRoute, oversizedRdsRoute } from './routes.js';

const configRouter = createConfigRouter();

configRouter.route(kmsKeyRotationRoute).route(elbListenerRoute).route(oversizedRdsRoute);

const lambdaRouter = new LambdaRouter({
  routers: [configRouter],
});

export const handler: Handler = lambdaRouter.handler();
