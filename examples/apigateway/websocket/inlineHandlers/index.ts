import { createWebSocketRouter } from '@lambda-event-router/apigateway';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { onConnectRoute } from './onConnect.js';
import { onDisconnectRoute } from './onDisconnect.js';
import { onSendMessageRoute } from './onMessage.js';

const webSocketRouter = createWebSocketRouter();

webSocketRouter.route(onConnectRoute).route(onDisconnectRoute).route(onSendMessageRoute);

const eventRouter = new EventRouter({
  routers: [webSocketRouter],
});

export const handler: Handler = eventRouter.handler();
