import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { stepFunctionsRouter } from './stepfunctions.js';

const lambdaRouter = new LambdaRouter({ routers: [stepFunctionsRouter] });

export const handler: Handler = lambdaRouter.handler();
