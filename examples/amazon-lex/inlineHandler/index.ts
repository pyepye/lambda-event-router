import { createAmazonLexRouter } from '@lambda-event-router/amazon-lex';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { allIntentsRoute } from './handlers/allIntentsRoute.js';
import { confirmRoute } from './handlers/confirmRoute.js';
import { dialogHookRoute } from './handlers/dialogHookRoute.js';
import { fulfillmentRoute } from './handlers/fulfillmentRoute.js';
import { inputModeRoute } from './handlers/inputModeRoute.js';

const amazonLexRouter = createAmazonLexRouter();

amazonLexRouter
  .route(dialogHookRoute)
  .route(fulfillmentRoute)
  .route(allIntentsRoute)
  .route(inputModeRoute)
  .route(confirmRoute);

const eventRouter = new EventRouter({
  routers: [amazonLexRouter],
});

export const handler: Handler = eventRouter.handler();
