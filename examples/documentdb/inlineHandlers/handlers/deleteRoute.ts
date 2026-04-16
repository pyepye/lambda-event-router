import { defineRoute } from '@lambda-event-router/documentdb';

import { CLUSTER_ARN } from '../constants.js';
import { orderDocumentKeySchema } from '../orderSchemas.js';

// DELETE events always have:
//   documentKey - the _id of the deleted document
// DELETE events optionally have (depends on change stream configuration):
//   fullDocumentBeforeChange - only present if the change stream was opened with
//                              fullDocumentBeforeChange: 'whenAvailable' | 'required' (MongoDB 6.0+)
// DELETE events never have:
//   fullDocument      - the document no longer exists
//   updateDescription - only present on 'update' events
export const deleteRoute = defineRoute({
  filters: {
    operationType: 'delete',
    eventSourceArn: CLUSTER_ARN,
    // No fullDocumentBeforeChange filter here - this handler only needs the documentKey
  },
  documentKeySchema: orderDocumentKeySchema,
}).handle(async ({ documentKey }) => {
  console.log(`Order deleted: ${documentKey._id}`);
});
