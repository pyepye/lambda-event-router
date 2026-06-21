import { isObject, logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/documentdb';

import { CLUSTER_ARN } from '../config.js';
import { COLLECTIONS, DATABASES } from '../utils/cluster.js';
import { DocumentKeySchema, OrderSchema } from '../utils/schemas.js';

const HIGH_VALUE_TOTAL = 500;

// A large order goes to a human before it is fulfilled. The custom filter reads the raw change event
// before any schema runs, so it guards with isObject and converts the total itself. Registered before
// createOrder so a large order wins here rather than on the collection filter.
export const escalateHighValueOrder = defineRoute({
  filters: {
    operationType: 'insert',
    eventSourceArn: CLUSTER_ARN,
    database: DATABASES.storefront,
    collection: COLLECTIONS.orders,
    custom: ({ event }) => isObject(event.fullDocument) && Number(event.fullDocument.total) >= HIGH_VALUE_TOTAL,
  },
  documentKeySchema: DocumentKeySchema,
  fullDocumentSchema: OrderSchema,
}).handle(async (request) => {
  logger.info({
    message: 'High value order escalated',
    reference: request.fullDocument.reference,
    total: request.fullDocument.total,
  });
});
