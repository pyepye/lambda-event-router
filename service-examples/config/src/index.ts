import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { configRouter } from './configRouter.js';
import { configScheduledRouter } from './configScheduledRouter.js';

// Both routers take Config rule events. The invokingEvent's messageType decides which one claims it.
const lambdaRouter = new LambdaRouter({ routers: [configRouter, configScheduledRouter] });

export const handler: Handler = lambdaRouter.handler();
