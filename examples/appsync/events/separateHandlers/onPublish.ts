import type { AppSyncEventsFilterInput, AppSyncEventsRequest } from '@lambda-event-router/appsync';

export function isChatChannel({ channel }: AppSyncEventsFilterInput): boolean {
  return channel.startsWith('/default/chat/');
}

// Standalone PUBLISH handler - processes events published to a channel namespace.
// Can transform, validate, or reject events before they reach subscribers.
export async function onPublish(request: AppSyncEventsRequest) {
  const { channel, events } = request;

  console.log(`Processing ${events.length} event(s) on channel ${channel}`);

  // Transform or filter events before delivery to subscribers
  const processedEvents = events.map((event) => ({
    ...event,
    processedAt: new Date().toISOString(),
  }));

  return { events: processedEvents };
}
