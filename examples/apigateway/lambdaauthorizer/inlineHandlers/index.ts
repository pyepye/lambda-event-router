import { createLambdaAuthorizerRouter } from '@lambda-event-router/apigateway';
import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { onRequestAuthRoute } from './onRequestAuth.js';
import { onRequestAuthSimpleRoute } from './onRequestAuthSimple.js';
import { onTokenAuthRoute } from './onTokenAuth.js';

const lambdaAuthorizerRouter = createLambdaAuthorizerRouter();

lambdaAuthorizerRouter.route(onTokenAuthRoute).route(onRequestAuthRoute).route(onRequestAuthSimpleRoute);

const lambdaRouter = new LambdaRouter({
  routers: [lambdaAuthorizerRouter],
});

export const handler: Handler = lambdaRouter.handler();
