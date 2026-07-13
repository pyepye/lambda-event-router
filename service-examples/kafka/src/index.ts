import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { kafkaRouter } from './kafka.js';

const lambdaRouter = new LambdaRouter({ routers: [kafkaRouter] });

export const handler: Handler = lambdaRouter.handler();
