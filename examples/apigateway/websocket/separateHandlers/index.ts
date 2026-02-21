import { createWebSocketRouter } from '@lambda-event-router/apigateway';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { onConnect } from './onConnect.js';
import { onMessage, SendMessageBodySchema } from './onMessage.js';

const webSocketRouter = createWebSocketRouter();

// Convenience methods for common event types
webSocketRouter.connect({
  handler: onConnect,
});

webSocketRouter.disconnect({
  handler: async ({ connectionId }) => {
    console.log(`Connection ${connectionId} disconnected, cleaning up`);
    // Remove connection from your data store
  },
});

// .message() accepts an optional routeKey filter
webSocketRouter.message({
  routeKey: 'sendMessage',
  bodySchema: SendMessageBodySchema,
  handler: onMessage,
});

// .route() for custom route keys
webSocketRouter.route({
  filters: { routeKey: '$default' },
  handler: async ({ connectionId, body }) => {
    console.log(`Unrecognised action from ${connectionId}: ${body}`);
  },
});

const eventRouter = new EventRouter({
  routers: [webSocketRouter],
});

export const handler: Handler = eventRouter.handler();
