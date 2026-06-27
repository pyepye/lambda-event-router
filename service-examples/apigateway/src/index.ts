import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { apiRouter } from './apiRouter.js';
import { webSocketRouter } from './webSocketRouter.js';

const lambdaRouter = new LambdaRouter({ routers: [apiRouter, webSocketRouter] });

export const handler: Handler = lambdaRouter.handler();
