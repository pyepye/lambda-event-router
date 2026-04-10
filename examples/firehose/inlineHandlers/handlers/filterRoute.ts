import { Dropped, Ok, defineRoute, type FirehoseFilterInput } from '@lambda-event-router/firehose';
import { z } from 'zod';

import { SOURCE_KINESIS_STREAM_ARN } from '../constants.js';

const EventDataSchema = z.object({
  eventType: z.string(),
  userId: z.string(),
  action: z.string(),
  timestamp: z.number(),
});

const STALE_EVENT_THRESHOLD_MS = 60_000;

// data is unknown (decoded but not schema-validated) - narrow before accessing properties
function isUserEvent({ data }: FirehoseFilterInput): boolean {
  if (typeof data !== 'object' || data === null) return false;
  if (!('eventType' in data) || typeof data.eventType !== 'string') return false;
  return data.eventType === 'USER_ACTION';
}

export const filterRoute = defineRoute({
  filters: {
    sourceKinesisStreamArns: [SOURCE_KINESIS_STREAM_ARN],
    customFilter: isUserEvent,
  },
  dataSchema: EventDataSchema,
}).handle(async ({ data, approximateArrivalTimestamp }) => {
  const isValid = data.userId.length > 0 && data.action.length > 0;

  if (!isValid) {
    // Dropped() tells the router to exclude this record from the output
    return Dropped();
  }

  const eventAge = approximateArrivalTimestamp - data.timestamp;
  const isStale = eventAge > STALE_EVENT_THRESHOLD_MS;

  if (isStale) {
    // Dropped() can also be thrown
    return Dropped();
  }

  // Ok() with no args = pass-through of original data unchanged (no re-encoding)
  return Ok();
});
