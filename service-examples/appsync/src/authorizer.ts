import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { authorizerRouter } from './authorizerRouter.js';

const lambdaRouter = new LambdaRouter({ routers: [authorizerRouter] });

export const handler: Handler = lambdaRouter.handler();
