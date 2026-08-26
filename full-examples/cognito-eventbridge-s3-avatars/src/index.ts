import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { cognitoRouter } from './cognito.js';
import { eventBridgeRouter } from './eventbridge.js';
import { s3Router } from './s3.js';

const lambdaRouter = new LambdaRouter({ routers: [cognitoRouter, eventBridgeRouter, s3Router] });

export const handler: Handler = lambdaRouter.handler();
