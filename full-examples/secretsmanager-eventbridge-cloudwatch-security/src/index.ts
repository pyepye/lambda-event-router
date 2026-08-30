import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { cloudWatchLogsRouter } from './cloudwatch.js';
import { eventBridgeRouter } from './eventbridge.js';
import { secretsManagerRouter } from './secretsmanager.js';

const lambdaRouter = new LambdaRouter({ routers: [eventBridgeRouter, cloudWatchLogsRouter, secretsManagerRouter] });

export const handler: Handler = lambdaRouter.handler();
