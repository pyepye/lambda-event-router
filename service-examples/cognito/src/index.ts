import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { cognitoRouter } from './cognito.js';

const lambdaRouter = new LambdaRouter({ routers: [cognitoRouter] });

export const handler: Handler = lambdaRouter.handler();
