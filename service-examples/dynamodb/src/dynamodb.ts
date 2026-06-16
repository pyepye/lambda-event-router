import { createDynamoDBRouter } from '@lambda-event-router/dynamodb';

import { archiveOrder } from './handlers/archiveOrder.js';
import { chargeCard } from './handlers/chargeCard.js';
import { handleOrderStatusChange } from './handlers/handleOrderStatusChange.js';
import { invalidateSearchCache } from './handlers/invalidateSearchCache.js';
import { processOrder } from './handlers/processOrder.js';
import { recordOrderEdit } from './handlers/recordOrderEdit.js';
import { syncCustomerProfile } from './handlers/syncCustomerProfile.js';
import { logChange } from './middleware/logChange.js';

// `keys` is required here: both tables have a composite key, and the router cannot guess which of the
// two attributes the partitionKey and sortKey filters mean.
export const dynamoDBRouter = createDynamoDBRouter({
  batchItemFailures: true,
  keys: { partitionKey: 'pk', sortKey: 'sk' },
  middleware: [logChange],
});

// Order matters: handleOrderStatusChange's custom filter must win over recordOrderEdit, which takes
// every other edit to a SUMMARY item, so it is registered first.
dynamoDBRouter
  .insert(processOrder)
  .insert(chargeCard)
  .modify(handleOrderStatusChange)
  .modify(recordOrderEdit)
  .remove(archiveOrder)
  .route(syncCustomerProfile)
  .route(invalidateSearchCache);
