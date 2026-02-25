import type { AppSyncEventsRequest } from '@lambda-event-router/appsync';

// Standalone SUBSCRIBE handler — authorizes or rejects subscription requests to a channel.
// Return the event to allow, or throw/reject to deny the subscription.
export async function onSubscribe(request: AppSyncEventsRequest) {
  const { channel, identity } = request;

  const userId = identity?.claims?.sub;

  // e.g. check if the user is allowed to subscribe to this channel
  console.log(`User ${userId} subscribing to channel ${channel}`);

  // Returning the event allows the subscription
  return { channel };
}
