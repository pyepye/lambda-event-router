import { LambdaRouter } from '@lambda-event-router/base';
import { createStepFunctionsRouter } from '@lambda-event-router/stepfunctions';
import type { Handler } from 'aws-lambda';

import { enrichDataRoute, humanApprovalRoute, processOrderRoute } from './handlers/taskRoutes.js';

const stepFunctionsRouter = createStepFunctionsRouter();

stepFunctionsRouter.route(processOrderRoute).route(enrichDataRoute).route(humanApprovalRoute);

const lambdaRouter = new LambdaRouter({
  routers: [stepFunctionsRouter],
});

export const handler: Handler = lambdaRouter.handler();
