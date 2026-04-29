import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { apiRouter } from './api.js';
import { dynamoDBRouter } from './dynamodb.js';
import { sqsRouter } from './sqs.js';

const lambdaRouter = new LambdaRouter({ routers: [apiRouter, dynamoDBRouter, sqsRouter] });

export const handler: Handler = lambdaRouter.handler();
