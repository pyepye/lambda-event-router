import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { cloudwatchRouter } from './cloudwatch.js';

const lambdaRouter = new LambdaRouter({ routers: [cloudwatchRouter] });

export const handler: Handler = lambdaRouter.handler();
