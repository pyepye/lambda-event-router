import { logger } from '@lambda-event-router/base';
import { defineRoute, Failed, Ok } from '@lambda-event-router/firehose';

import { CLICKSTREAM_ARN, EVENT_FRESHNESS_MS } from '../config.js';
import { eventTypeOf } from '../utils/events.js';
import { PageViewSchema } from '../utils/schemas.js';

// Page views are stored as they arrive, so the handler returns Ok with no data and Firehose keeps the
// record it was given.
//
// An event past the freshness window is refused by throwing Failed(). The router recognises a thrown
// response and maps it straight to ProcessingFailed, so nothing is logged as an error.
export const recordPageView = defineRoute({
  filters: {
    deliveryStreamArn: CLICKSTREAM_ARN,
    custom: ({ data }) => eventTypeOf(data) === 'pageView',
  },
  dataSchema: PageViewSchema,
}).handle(async ({ data, recordId }) => {
  const ageMs = Date.now() - Date.parse(data.occurredAt);

  if (ageMs > EVENT_FRESHNESS_MS) {
    logger.warn({ message: 'Page view too old to store', recordId, ageMs });
    throw Failed();
  }

  logger.info({ message: 'Page view recorded', url: data.url, visitorId: data.visitorId });

  return Ok();
});
