import { defineEventsRoute } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

import {
  PROBE_BARE_CHANNEL,
  PROBE_BOTH_CHANNEL,
  PROBE_BOTH_TOP_CHANNEL,
  PROBE_EMPTY_CHANNEL,
  PROBE_EMPTY_LIST_CHANNEL,
  PROBE_ERROR_ONLY_CHANNEL,
  PROBE_EXTRA_ENTRY_CHANNEL,
  PROBE_EXTRA_TOP_CHANNEL,
  PROBE_ID_ONLY_CHANNEL,
  PROBE_NAMESPACE,
  PROBE_NOTHING_CHANNEL,
} from '../utils/constants.js';

// A per-event error reaches the publish response, so reporting what arrived as the error message is
// how the probe reads a payload back without a subscriber or a log query.
function describe(payload: unknown): string {
  if (payload === null) return 'type=null json=null';
  const type = Array.isArray(payload) ? 'array' : typeof payload;
  return `type=${type} json=${JSON.stringify(payload)}`;
}

export const probeEvents = defineEventsRoute({
  filters: { channelNamespace: PROBE_NAMESPACE, operation: 'PUBLISH' },
}).handle(async ({ channelPath, events }) => {
  logger.info({ message: 'Probe publish', channelPath, events });

  const echoed = events.map((event) => ({ id: String(event.id), payload: event.payload }));

  if (channelPath === PROBE_BARE_CHANNEL) return echoed;
  if (channelPath === PROBE_EMPTY_CHANNEL) return {};
  if (channelPath === PROBE_NOTHING_CHANNEL) return undefined;
  if (channelPath === PROBE_EXTRA_ENTRY_CHANNEL) {
    return { events: echoed.map((entry) => ({ ...entry, somethingElse: true })) };
  }
  if (channelPath === PROBE_EXTRA_TOP_CHANNEL) return { events: echoed, alsoUnknown: 1 };
  if (channelPath === PROBE_ERROR_ONLY_CHANNEL) return { error: 'a top level error on its own' };
  if (channelPath === PROBE_EMPTY_LIST_CHANNEL) return { events: [] };
  if (channelPath === PROBE_BOTH_TOP_CHANNEL) return { events: echoed, error: 'a top level error beside events' };
  if (channelPath === PROBE_ID_ONLY_CHANNEL) return { events: echoed.map(({ id }) => ({ id })) };

  if (channelPath === PROBE_BOTH_CHANNEL) {
    return {
      events: events.map((event) => ({
        id: String(event.id),
        payload: { carriedAPayload: true },
        error: 'both fields set on one entry',
      })),
    };
  }

  return {
    events: events.map((event) => ({
      id: String(event.id),
      error: describe(event.payload),
    })),
  };
});
