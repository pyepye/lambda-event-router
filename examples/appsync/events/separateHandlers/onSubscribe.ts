import type { AppSyncEventsRequest } from '@lambda-event-router/appsync';

// Standalone SUBSCRIBE handler - authorizes or rejects subscription requests to a channel.
// Returning allows the subscription, throwing refuses it.
export async function onSubscribe(request: AppSyncEventsRequest) {
  const { channelPath, identity } = request;

  const userId = identity?.claims?.sub;

  // e.g. check if the user is allowed to subscribe to this channel
  console.log(`User ${userId} subscribing to channel ${channelPath}`);
}
