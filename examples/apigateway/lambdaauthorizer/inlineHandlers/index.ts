import { createLambdaAuthorizerRouter } from '@lambda-event-router/apigateway';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { onRequestAuthRoute } from './onRequestAuth.js';
import { onRequestAuthSimpleRoute } from './onRequestAuthSimple.js';
import { onTokenAuthRoute } from './onTokenAuth.js';

const lambdaAuthorizerRouter = createLambdaAuthorizerRouter();

lambdaAuthorizerRouter.route(onTokenAuthRoute).route(onRequestAuthRoute).route(onRequestAuthSimpleRoute);

const eventRouter = new EventRouter({
  routers: [lambdaAuthorizerRouter],
});

export const handler: Handler = eventRouter.handler();
