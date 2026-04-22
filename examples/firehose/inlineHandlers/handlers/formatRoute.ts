import { z } from 'zod';

import { defineRoute, Ok } from '@lambda-event-router/firehose';

import { ANALYTICS_DELIVERY_STREAM_ARN } from '../constants.js';

const AnalyticsDataSchema = z.object({
  eventId: z.string(),
  timestamp: z.string(),
  category: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export const formatRoute = defineRoute({
  filters: {
    deliveryStreamArn: ANALYTICS_DELIVERY_STREAM_ARN,
  },
  dataSchema: AnalyticsDataSchema,
}).handle(async ({ data }) => {
  const eventDate = new Date(data.timestamp);
  const year = String(eventDate.getUTCFullYear());
  const month = String(eventDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(eventDate.getUTCDate()).padStart(2, '0');

  const formattedData = {
    id: data.eventId,
    ts: data.timestamp,
    cat: data.category,
    ...data.payload,
  };

  // Ok() accepts optional metadata as second arg for dynamic partitioning
  return Ok(formattedData, {
    partitionKeys: { year, month, day, category: data.category },
  });
});
