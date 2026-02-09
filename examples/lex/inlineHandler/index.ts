import { EventRouter } from '@lambda-event-router/base';
import { createLexRouter } from '@lambda-event-router/lex';
import type { Handler } from 'aws-lambda';

import { allIntentsRoute } from './handlers/allIntentsRoute.js';
import { confirmRoute } from './handlers/confirmRoute.js';
import { dialogHookRoute } from './handlers/dialogHookRoute.js';
import { fulfillmentRoute } from './handlers/fulfillmentRoute.js';
import { inputModeRoute } from './handlers/inputModeRoute.js';

const lexRouter = createLexRouter();

lexRouter
  .route(dialogHookRoute)
  .route(fulfillmentRoute)
  .route(allIntentsRoute)
  .route(inputModeRoute)
  .route(confirmRoute);

const eventRouter = new EventRouter({
  routers: [lexRouter],
});

export const handler: Handler = eventRouter.handler();
