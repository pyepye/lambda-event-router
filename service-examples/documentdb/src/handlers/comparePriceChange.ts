import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/documentdb';

import { CLUSTER_ARN } from '../config.js';
import { COLLECTIONS, DATABASES } from '../utils/cluster.js';
import { DocumentKeySchema, PriceHistorySchema } from '../utils/schemas.js';

// Comparing a price against the one it replaced needs the document as it was before the change. A
// Lambda event source mapping configures fullDocument and nothing else, so a change stream it opens
// never carries a before image and this route fails every change it takes.
export const comparePriceChange = defineRoute({
  filters: {
    operationType: 'update',
    eventSourceArn: CLUSTER_ARN,
    database: DATABASES.fulfilment,
    collection: COLLECTIONS.priceHistory,
    fullDocumentBeforeChange: 'whenAvailable',
  },
  documentKeySchema: DocumentKeySchema,
  fullDocumentBeforeChangeSchema: PriceHistorySchema,
}).handle(async (request) => {
  logger.info({
    message: 'Price change compared',
    sku: request.fullDocumentBeforeChange.sku,
    previousPrice: request.fullDocumentBeforeChange.price,
  });
});
