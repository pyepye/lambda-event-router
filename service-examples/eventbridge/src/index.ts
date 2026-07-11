import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { eventBridgeRouter } from './eventbridge.js';

const lambdaRouter = new LambdaRouter({ routers: [eventBridgeRouter] });

export const handler: Handler = lambdaRouter.handler();
