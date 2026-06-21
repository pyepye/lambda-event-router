import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { documentDBRouter } from './documentdb.js';

const lambdaRouter = new LambdaRouter({ routers: [documentDBRouter] });

export const handler: Handler = lambdaRouter.handler();
