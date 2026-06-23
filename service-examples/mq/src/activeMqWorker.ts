import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { activeMqRouter } from './activeMq.js';

const lambdaRouter = new LambdaRouter({ routers: [activeMqRouter] });

export const handler: Handler = lambdaRouter.handler();
