import { type AppSyncEventsFilterInput, defineEventsRoute } from '@lambda-event-router/appsync';

// PUBLISH handler — processes events published to a channel namespace.
// Can transform, validate, or reject events before they reach subscribers.
export const onPublishRoute = defineEventsRoute({
  filters: {
    operations: ['PUBLISH'],
    channelNamespaces: ['/default/*'],
  },
}).handle(async (request) => {
  const { channel, events } = request;

  console.log(`Processing ${events.length} event(s) on channel ${channel}`);

  // Transform or filter events before delivery to subscribers
  const processedEvents = events.map((event) => ({
    ...event,
    processedAt: new Date().toISOString(),
  }));

  return { events: processedEvents };
});

// Match publish events containing message-type payloads — filters on event data, not channel path
export const messageEventPublishRoute = defineEventsRoute({
  filters: {
    operations: ['PUBLISH'],
    channelNamespaces: ['/default/chat/*'],
    customFilter: ({ event }: AppSyncEventsFilterInput) => {
      return Object.keys(event.stash ?? {}).length > 1;
    },
  },
}).handle(async (request) => {
  const { channel, events } = request;

  console.log(`Chat message: ${events.length} event(s) on ${channel}`);

  const processedEvents = events.map((event) => ({
    ...event,
    processedAt: new Date().toISOString(),
  }));

  return { events: processedEvents };
});
