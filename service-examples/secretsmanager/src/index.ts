import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { secretsManagerRouter } from './secretsManager.js';

const lambdaRouter = new LambdaRouter({ routers: [secretsManagerRouter] });

export const handler: Handler = lambdaRouter.handler();
