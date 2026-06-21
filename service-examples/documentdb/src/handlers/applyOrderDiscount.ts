import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/documentdb';

import { CLUSTER_ARN } from '../config.js';
import { COLLECTIONS, DATABASES } from '../utils/cluster.js';
import { DocumentKeySchema, OrderSchema } from '../utils/schemas.js';

// The fullDocument declaration is what makes request.fullDocument non-optional here. It has to match
// the UpdateLookup setting on the event source mapping, or the field is typed present and arrives
// undefined.
export const applyOrderDiscount = defineRoute({
  filters: {
    operationType: 'update',
    eventSourceArn: CLUSTER_ARN,
    database: DATABASES.storefront,
    collection: COLLECTIONS.orders,
    fullDocument: 'updateLookup',
  },
  documentKeySchema: DocumentKeySchema,
  fullDocumentSchema: OrderSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Order discount applied',
    reference: request.fullDocument.reference,
    total: request.fullDocument.total,
    status: request.fullDocument.status,
    updatedFields: Object.keys(request.updateDescription.updatedFields ?? {}),
    removedFields: request.updateDescription.removedFields ?? [],
  });
});
