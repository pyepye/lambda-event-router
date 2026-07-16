import type { Handler } from 'aws-lambda';

import { createLambdaAuthorizerRouter } from '@lambda-event-router/apigateway';
import { LambdaRouter } from '@lambda-event-router/base';

import { onRequestAuth } from './onRequestAuth.js';
import { onRequestAuthSimple } from './onRequestAuthSimple.js';
import { onTokenAuth } from './onTokenAuth.js';

const lambdaAuthorizerRouter = createLambdaAuthorizerRouter();

// Convenience methods for common authorizer types
lambdaAuthorizerRouter.token({
  handler: onTokenAuth,
});

// The GET route is narrower, so it goes above the request route that matches every method
lambdaAuthorizerRouter.request({
  method: 'GET',
  handler: onRequestAuthSimple,
});

lambdaAuthorizerRouter.request({
  handler: onRequestAuth,
});

const lambdaRouter = new LambdaRouter({
  routers: [lambdaAuthorizerRouter],
});

export const handler: Handler = lambdaRouter.handler();
