import { isObject } from '@latcher/base';
import { defineRoute } from '@latcher/stepfunctions';

import { RELEASE_STOCK_HOLD_TASK } from '../config.js';
import { ReleaseStockHoldSchema } from '../utils/schemas.js';

// The warehouse API is down, so this route always throws. The throw happens after the middleware
// chain has run, which is what separates it from a payload that fails its schema.
export const releaseStockHold = defineRoute({
  filters: {
    custom: ({ event }) => isObject(event) && event.task === RELEASE_STOCK_HOLD_TASK,
  },
  eventSchema: ReleaseStockHoldSchema,
}).handle(async (request) => {
  throw new Error(`Warehouse API unavailable for ${request.event.reservationId}`);
});
