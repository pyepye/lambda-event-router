import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { s3Router } from './s3.js';

const lambdaRouter = new LambdaRouter({ routers: [s3Router] });

export const handler: Handler = lambdaRouter.handler();
