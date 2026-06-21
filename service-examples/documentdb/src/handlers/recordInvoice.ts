import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/documentdb';

import { CLUSTER_ARN } from '../config.js';
import { COLLECTIONS, DATABASES } from '../utils/cluster.js';
import { DocumentKeySchema, InvoiceSchema } from '../utils/schemas.js';

// An invoice is written once and reissued by replacing it, so one route takes both operations. Both
// carry a full document, which is what lets the two share a schema.
export const recordInvoice = defineRoute({
  filters: {
    operationType: ['insert', 'replace'],
    eventSourceArn: CLUSTER_ARN,
    database: DATABASES.storefront,
    collection: COLLECTIONS.invoices,
  },
  documentKeySchema: DocumentKeySchema,
  fullDocumentSchema: InvoiceSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Invoice recorded',
    operationType: request.operationType,
    orderReference: request.fullDocument.orderReference,
    amount: request.fullDocument.amount,
  });
});
