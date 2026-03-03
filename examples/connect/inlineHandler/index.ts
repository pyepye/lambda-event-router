import { EventRouter } from '@lambda-event-router/base';
import { createConnectRouter } from '@lambda-event-router/connect';
import type { Handler } from 'aws-lambda';

import { allChannelsRoute } from './handlers/allChannelsRoute.js';
import { callbackRoute } from './handlers/callbackRoute.js';
import { chatRoute } from './handlers/chatRoute.js';
import { vipCallerRoute, voiceInboundRoute } from './handlers/voiceInboundRoute.js';

const connectRouter = createConnectRouter();

connectRouter
  .route(voiceInboundRoute)
  .route(chatRoute)
  .route(callbackRoute)
  .route(allChannelsRoute)
  .route(vipCallerRoute);

const eventRouter = new EventRouter({
  routers: [connectRouter],
});

export const handler: Handler = eventRouter.handler();
