import { createSNSRouter } from '@lambda-event-router/sns';

import { cancelOrder } from './handlers/cancelOrder.js';
import { chargeCard } from './handlers/chargeCard.js';
import { expediteOrder } from './handlers/expediteOrder.js';
import { processOrder } from './handlers/processOrder.js';
import { recordDeliveryFailure } from './handlers/recordDeliveryFailure.js';
import { reserveStock } from './handlers/reserveStock.js';
import { logDelivery } from './middleware/logDelivery.js';

// SNS delivers one record per invocation and has no partial batch response, so a failing record fails
// the invocation. That is what gets it retried and then sent to the delivery failures topic.
export const snsRouter = createSNSRouter({
  middleware: [logDelivery],
});

// Order matters: expediteOrder's custom filter must win over processOrder's eventType filter for an
// express order, so it is registered first.
snsRouter
  .route(recordDeliveryFailure)
  .route(expediteOrder)
  .route(cancelOrder)
  .route(chargeCard)
  .route(processOrder)
  .route(reserveStock);
