import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { connectRouter } from './connect.js';

const lambdaRouter = new LambdaRouter({ routers: [connectRouter] });

export const handler: Handler = lambdaRouter.handler();
