import { defineRoute } from '@lambda-event-router/documentdb';

import { CLUSTER_ARN } from '../constants.js';
import { orderDocumentKeySchema, orderFullDocumentSchema } from '../orderSchemas.js';

// REPLACE events always have:
//   documentKey  - the _id of the replaced document
//   fullDocument - the new replacement document (always present, no config needed)
// REPLACE events optionally have (depends on change stream configuration):
//   fullDocumentBeforeChange - only present if the change stream was opened with
//                              fullDocumentBeforeChange: 'whenAvailable' | 'required' (MongoDB 6.0+)
// REPLACE events never have:
//   updateDescription - only present on 'update' events
export const replaceRoute = defineRoute({
  filters: {
    operationType: 'replace',
    eventSourceArn: CLUSTER_ARN,
    // No fullDocument filter needed - replace events always include fullDocument
  },
  documentKeySchema: orderDocumentKeySchema,
  fullDocumentSchema: orderFullDocumentSchema,
}).handle(async ({ documentKey, fullDocument }) => {
  console.log(`Order ${documentKey._id} replaced with new document`);
  console.log(`New status: ${fullDocument.status}, total: ${fullDocument.total}`);
});
