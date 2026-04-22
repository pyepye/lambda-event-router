import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createLexRouter } from '@lambda-event-router/lex';

import { allIntentsRoute } from './handlers/allIntentsRoute.js';
import { confirmRoute } from './handlers/confirmRoute.js';
import { dialogHookRoute } from './handlers/dialogHookRoute.js';
import { fulfillmentRoute, premiumFulfillmentRoute } from './handlers/fulfillmentRoute.js';
import { inputModeRoute } from './handlers/inputModeRoute.js';

const lexRouter = createLexRouter();

lexRouter
  .route(dialogHookRoute)
  .route(fulfillmentRoute)
  .route(allIntentsRoute)
  .route(inputModeRoute)
  .route(confirmRoute)
  .route(premiumFulfillmentRoute);

const lambdaRouter = new LambdaRouter({
  routers: [lexRouter],
});

export const handler: Handler = lambdaRouter.handler();
