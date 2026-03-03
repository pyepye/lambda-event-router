import { type DocumentDBFilterInput, defineRoute } from '@lambda-event-router/documentdb';

import { CLUSTER_ARN } from '../constants.js';
import { orderFullDocumentSchema } from '../orderSchemas.js';

// INSERT events always have:
//   documentKey  - the _id of the inserted document
//   fullDocument - the full inserted document
// INSERT events never have:
//   updateDescription          - only present on 'update' events
//   fullDocumentBeforeChange   - no previous document exists for an insert
export const insertRoute = defineRoute({
  filters: {
    operationTypes: ['insert'],
    eventSourceArns: [CLUSTER_ARN],
  },
  fullDocumentSchema: orderFullDocumentSchema,
}).handle(async ({ fullDocument }) => {
  console.log(`New order created: ${fullDocument._id} for customer ${fullDocument.customerId}`);
  console.log(`Order total: ${fullDocument.total}, status: ${fullDocument.status}`);
});

export const insertRoute2 = defineRoute({
  filters: {
    operationTypes: ['insert'],
    eventSourceArns: [CLUSTER_ARN],
  },
}).handle(async ({ fullDocument, documentKey }) => {
  console.log(`New order created: ${documentKey}`);
  console.log(`New order created: ${fullDocument._id} for customer ${fullDocument.customerId}`);
  console.log(`Order total: ${fullDocument.total}, status: ${fullDocument.status}`);
});

const HIGH_VALUE_ORDER_THRESHOLD = 500;

// Match high-value order inserts — filters on document content, not database/collection names
export const highValueOrderInsertRoute = defineRoute({
  filters: {
    operationTypes: ['insert'],
    eventSourceArns: [CLUSTER_ARN],
    databases: ['ecommerce'],
    collections: ['orders'],
    customFilter: ({ event }: DocumentDBFilterInput) => {
      const { fullDocument } = event;
      if (typeof fullDocument !== 'object' || fullDocument === null || !('total' in fullDocument)) return false;
      const { total } = fullDocument;
      return typeof total === 'number' && total > HIGH_VALUE_ORDER_THRESHOLD;
    },
  },
  fullDocumentSchema: orderFullDocumentSchema,
}).handle(async ({ fullDocument }) => {
  console.log(`High-value order inserted: ${fullDocument._id}`);
  console.log(`Customer: ${fullDocument.customerId}, total: ${fullDocument.total}`);
});
