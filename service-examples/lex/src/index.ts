import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { lexRouter } from './lex.js';

const lambdaRouter = new LambdaRouter({ routers: [lexRouter] });

export const handler: Handler = lambdaRouter.handler();
