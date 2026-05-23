import { defineEventsRoute } from '@lambda-event-router/appsync';

// SUBSCRIBE handler - authorizes or rejects subscription requests to a channel.
// Return the event to allow, or throw/reject to deny the subscription.
export const onSubscribeRoute = defineEventsRoute({
  filters: {
    operation: 'SUBSCRIBE',
    channelPath: '/default/*',
  },
}).handle(async (request) => {
  const { channelPath, identity } = request;

  const userId = identity?.claims?.sub;

  // e.g. check if the user is allowed to subscribe to this channel
  console.log(`User ${userId} subscribing to channel ${channelPath}`);

  // Returning allows the subscription, throwing refuses it
});
