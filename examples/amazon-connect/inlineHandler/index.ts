import { createAmazonConnectRouter } from '@lambda-event-router/amazon-connect';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { allChannelsRoute } from './handlers/allChannelsRoute.js';
import { callbackRoute } from './handlers/callbackRoute.js';
import { chatRoute } from './handlers/chatRoute.js';
import { voiceInboundRoute } from './handlers/voiceInboundRoute.js';

const amazonConnectRouter = createAmazonConnectRouter();

amazonConnectRouter.route(voiceInboundRoute).route(chatRoute).route(callbackRoute).route(allChannelsRoute);

const eventRouter = new EventRouter({
  routers: [amazonConnectRouter],
});

export const handler: Handler = eventRouter.handler();
