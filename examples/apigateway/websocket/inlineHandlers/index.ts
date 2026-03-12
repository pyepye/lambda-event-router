import { createWebSocketRouter } from '@lambda-event-router/apigateway';
import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { onConnectRoute } from './onConnect.js';
import { onDisconnectRoute } from './onDisconnect.js';
import { onSendMessageRoute } from './onMessage.js';

const webSocketRouter = createWebSocketRouter();

webSocketRouter.route(onConnectRoute).route(onDisconnectRoute).route(onSendMessageRoute);

const lambdaRouter = new LambdaRouter({
  routers: [webSocketRouter],
});

export const handler: Handler = lambdaRouter.handler();
