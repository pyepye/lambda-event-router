import { defineWebSocketRoute, WebSocketUnauthorised } from '@lambda-event-router/apigateway';

// CONNECT is invoked when a client first connects to the WebSocket API.
// Throwing WebSocketUnauthorised() returns { statusCode: 401 } and rejects the connection.
// Returning void signals success - the router auto-sends { statusCode: 200 }.
export const onConnectRoute = defineWebSocketRoute({
  filters: { eventType: 'CONNECT' },
}).handle(async (request) => {
  const { connectionId, queryStringParameters } = request;
  const token = queryStringParameters?.token;

  if (!token) {
    throw WebSocketUnauthorised();
  }

  console.log(`Connection ${connectionId} authenticated`);
});
