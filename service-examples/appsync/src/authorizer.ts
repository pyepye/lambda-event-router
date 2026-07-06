import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { authorizerRouter } from './authorizerRouter.js';
import { eventsAuthorizerRouter } from './eventsAuthorizerRouter.js';

// One function authorises both APIs. The two routers take different event shapes, so `LambdaRouter`
// picks between them without a filter.
const lambdaRouter = new LambdaRouter({ routers: [authorizerRouter, eventsAuthorizerRouter] });

export const handler: Handler = lambdaRouter.handler();
