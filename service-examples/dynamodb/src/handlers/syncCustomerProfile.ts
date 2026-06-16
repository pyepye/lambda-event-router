import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/dynamodb';

import { ORDERS_STREAM_ARN } from '../config.js';
import { CustomerSchema } from '../utils/schemas.js';

// A customer profile written by an upsert, so it arrives as an INSERT the first time and a MODIFY after
// that. `defineRoute` takes the two event names as one filter, which `insert` and `modify` cannot do.
// Filtering on two names narrows the request to those two branches, so `newImage` is always there and
// `request.eventName` still tells them apart.
export const syncCustomerProfile = defineRoute({
  filters: {
    eventSourceArn: ORDERS_STREAM_ARN,
    eventName: ['INSERT', 'MODIFY'],
    partitionKey: 'CUSTOMER#*',
  },
  newImageSchema: CustomerSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Customer profile synced',
    email: request.newImage.email,
    marketingOptIn: request.newImage.marketingOptIn,
    eventName: request.eventName,
    hadProfileBefore: request.eventName === 'MODIFY',
  });
});
