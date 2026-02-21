import { defineWebSocketRoute } from '@lambda-event-router/apigateway';

// DISCONNECT is invoked when a client disconnects from the WebSocket API.
// Returning void signals success — the router auto-sends { statusCode: 200 }.
export const onDisconnectRoute = defineWebSocketRoute({
  filters: { eventType: 'DISCONNECT' },
}).handle(async (request) => {
  const { connectionId } = request;

  console.log(`Connection ${connectionId} disconnected, cleaning up`);

  // Remove connection from your data store, e.g.:
  // await connectionsTable.delete({ connectionId });
});
