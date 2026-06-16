import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { dynamoDBRouter } from './dynamodb.js';

const lambdaRouter = new LambdaRouter({ routers: [dynamoDBRouter] });

export const handler: Handler = lambdaRouter.handler();
