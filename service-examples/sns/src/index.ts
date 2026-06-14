import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { snsRouter } from './sns.js';

const lambdaRouter = new LambdaRouter({ routers: [snsRouter] });

export const handler: Handler = lambdaRouter.handler();
