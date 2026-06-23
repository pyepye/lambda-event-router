import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { rabbitMqRouter } from './rabbitMq.js';

const lambdaRouter = new LambdaRouter({ routers: [rabbitMqRouter] });

export const handler: Handler = lambdaRouter.handler();
