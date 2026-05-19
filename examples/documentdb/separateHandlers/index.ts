import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import type { DocumentDBFilterInput } from '@lambda-event-router/documentdb';
import { createDocumentDBRouter } from '@lambda-event-router/documentdb';

import { deleteOrder } from './handlers/deleteOrder.js';
import { insertOrder } from './handlers/insertOrder.js';
import { replaceOrder } from './handlers/replaceOrder.js';
import { updateOrder } from './handlers/updateOrder.js';

const documentDBRouter = createDocumentDBRouter();

const CLUSTER_ARN = 'arn:aws:rds:eu-west-1:123456789012:cluster:my-documentdb-cluster';

// Generic .route() with full filters
documentDBRouter.route({
  filters: {
    eventSourceArn: CLUSTER_ARN,
    operationType: 'insert',
    database: 'ecommerce',
    collection: 'orders',
  },
  handler: insertOrder,
});

// Convenience method - .insert() pre-sets operationType to 'insert'
documentDBRouter.insert({
  filters: {
    eventSourceArn: CLUSTER_ARN,
    database: 'ecommerce',
    collection: 'orders',
  },
  handler: insertOrder,
});

// Convenience method - .update() pre-sets operationType to 'update'
// The fullDocument and fullDocumentBeforeChange filters match the MongoDB change stream
// configuration options - NOT the event fields themselves. Declaring them tells the router
// (and the types) that this handler expects those event fields to be populated.
documentDBRouter.update({
  filters: {
    eventSourceArn: CLUSTER_ARN,
    // Change stream was opened with fullDocument: 'updateLookup'
    // so the fullDocument event field will be populated on update events
    fullDocument: ['updateLookup'],
    // Change stream was opened with fullDocumentBeforeChange: 'whenAvailable' or 'required'
    // so the fullDocumentBeforeChange event field will be populated
    fullDocumentBeforeChange: ['whenAvailable', 'required'],
  },
  handler: updateOrder,
});

// Convenience method - .replace() pre-sets operationType to 'replace'
documentDBRouter.replace({
  filters: {
    eventSourceArn: CLUSTER_ARN,
    // No fullDocument filter needed - replace events always include fullDocument
    // fullDocumentBeforeChange could be added here if the change stream is configured for it
  },
  handler: replaceOrder,
});

// Convenience method - .delete() pre-sets operationType to 'delete'
documentDBRouter.delete({
  filters: {
    eventSourceArn: CLUSTER_ARN,
    // No fullDocumentBeforeChange filter - this handler only needs the documentKey
  },
  handler: deleteOrder,
});

// Custom filter function for complex matching logic
function isEcommerceOrderChange(input: DocumentDBFilterInput): boolean {
  return input.ns.db === 'ecommerce' && input.ns.coll === 'orders';
}

documentDBRouter.route({
  filters: {
    eventSourceArn: CLUSTER_ARN,
    operationType: 'update',
    custom: isEcommerceOrderChange,
  },
  handler: updateOrder,
});

const lambdaRouter = new LambdaRouter({
  routers: [documentDBRouter],
});

export const handler: Handler = lambdaRouter.handler();
