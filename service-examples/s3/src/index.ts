import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { s3BatchRouter, s3Router } from './s3.js';

const lambdaRouter = new LambdaRouter({ routers: [s3Router, s3BatchRouter] });

export const handler: Handler = lambdaRouter.handler();
