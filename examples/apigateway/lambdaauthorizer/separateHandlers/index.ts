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

lambdaAuthorizerRouter.request({
  handler: onRequestAuth,
});

lambdaAuthorizerRouter.request({
  method: 'GET',
  handler: onRequestAuthSimple,
});

const lambdaRouter = new LambdaRouter({
  routers: [lambdaAuthorizerRouter],
});

export const handler: Handler = lambdaRouter.handler();
