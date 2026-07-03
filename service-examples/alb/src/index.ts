import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { returnsRouter } from './returnsRouter.js';

const lambdaRouter = new LambdaRouter({ routers: [returnsRouter] });

export const handler: Handler = lambdaRouter.handler();
