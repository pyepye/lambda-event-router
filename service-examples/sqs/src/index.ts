import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { sqsRouter } from './sqs.js';

const lambdaRouter = new LambdaRouter({ routers: [sqsRouter] });

export const handler: Handler = lambdaRouter.handler();
