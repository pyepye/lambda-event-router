import type {
  AppSyncEventsFilterInput,
  AppSyncEventsPublishResult,
  AppSyncEventsRequest,
} from '@lambda-event-router/appsync';
import { isObject, logger } from '@lambda-event-router/base';

import { TYPING_EVENT } from '../utils/constants.js';

// Matches only when the whole batch is typing notices, so a mixed batch still reaches the handler
// that stores activity.
export function isTypingBatch({ event }: AppSyncEventsFilterInput): boolean {
  const events = event.events ?? [];
  if (events.length === 0) return false;

  return events.every((item) => isObject(item.payload) && item.payload.type === TYPING_EVENT);
}

// A typing notice is not worth broadcasting, so the batch is dropped. An empty list is how a publish
// handler says "broadcast nothing".
export async function holdTypingNotice({ events }: AppSyncEventsRequest): Promise<AppSyncEventsPublishResult> {
  logger.info({ message: 'Typing notices dropped', count: events.length });

  return { events: [] };
}
