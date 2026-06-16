import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/dynamodb';

import { SearchKeysSchema } from '../utils/schemas.js';

// Every change to the search index evicts one cache entry, and the key is all that takes. The
// streamViewType filter is what picks the index out: its stream is KEYS_ONLY and the orders stream is
// NEW_AND_OLD_IMAGES.
// No event name filter, so the request spans all three branches and `hasImages` reports what a
// KEYS_ONLY record actually carries.
export const invalidateSearchCache = defineRoute({
  filters: {
    streamViewType: 'KEYS_ONLY',
  },
  keysSchema: SearchKeysSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Search cache invalidated',
    sku: request.keys.pk.slice('PRODUCT#'.length),
    eventName: request.eventName,
    hasImages: Boolean(request.newImage ?? request.oldImage),
  });
});
