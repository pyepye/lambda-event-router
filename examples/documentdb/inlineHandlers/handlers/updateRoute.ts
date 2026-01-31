import { defineRoute } from '@lambda-event-router/documentdb';

import { CLUSTER_ARN } from '../constants.js';
import {
  orderDocumentKeySchema,
  orderFullDocumentBeforeChangeSchema,
  orderFullDocumentSchema,
} from '../orderSchemas.js';

// UPDATE events always have:
//   documentKey       - the _id of the updated document
//   updateDescription - { updatedFields: Record<string, unknown>, removedFields: string[] }
// UPDATE events optionally have (depends on change stream configuration):
//   fullDocument             - only present if the change stream was opened with
//                              fullDocument: 'updateLookup' (or 'whenAvailable'/'required' on MongoDB 6.0+)
//   fullDocumentBeforeChange - only present if the change stream was opened with
//                              fullDocumentBeforeChange: 'whenAvailable' | 'required' (MongoDB 6.0+)
//
// The fullDocument and fullDocumentBeforeChange filters below match the MongoDB change stream
// configuration options — NOT the event fields themselves. Declaring them here tells the router
// (and the types) that this handler expects those fields to be present on the event.
export const updateRoute = defineRoute({
  filters: {
    operationTypes: ['update'],
    eventSourceArns: [CLUSTER_ARN],
    // Match the change stream config — these control whether the event fields are populated
    fullDocument: ['updateLookup'],
    fullDocumentBeforeChange: ['whenAvailable', 'required'],
  },
  documentKeySchema: orderDocumentKeySchema,
  fullDocumentSchema: orderFullDocumentSchema,
  fullDocumentBeforeChangeSchema: orderFullDocumentBeforeChangeSchema,
}).handle(async ({ documentKey, updateDescription, fullDocument, fullDocumentBeforeChange }) => {
  console.log(`Order ${documentKey._id} updated`);

  // updateDescription is always present on update events
  // updatedFields contains whichever fields changed — the shape is unpredictable
  const { updatedFields, removedFields } = updateDescription;

  if (updatedFields?.status) {
    console.log(`Status changed to: ${updatedFields.status}`);
  }

  if (removedFields && removedFields.length > 0) {
    console.log(`Fields removed: ${removedFields.join(', ')}`);
  }

  // Because the filters declared fullDocument and fullDocumentBeforeChange above,
  // the types know these fields are present — no guards needed
  console.log(`Current status: ${fullDocument.status}`);
  console.log(`Previous status: ${fullDocumentBeforeChange.status}`);
});
