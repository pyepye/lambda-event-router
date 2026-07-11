import { createEventBridgeRouter } from '@lambda-event-router/eventbridge';

import { archivePartnerOrder } from './handlers/archivePartnerOrder.js';
import { dispatchShipment } from './handlers/dispatchShipment.js';
import { flagHighValueOrder } from './handlers/flagHighValueOrder.js';
import { mirrorOrderUpdate } from './handlers/mirrorOrderUpdate.js';
import { processOrder } from './handlers/processOrder.js';
import { routeToLeedsWarehouse } from './handlers/routeToLeedsWarehouse.js';
import { settlePaymentLedger } from './handlers/settlePaymentLedger.js';
import { updateOrder } from './handlers/updateOrder.js';
import { logEvent } from './middleware/logEvent.js';

export const eventBridgeRouter = createEventBridgeRouter({
  middleware: [logEvent],
});

// Order matters twice here. flagHighValueOrder must win over processOrder for a large order, and
// routeToLeedsWarehouse must win over dispatchShipment for Leeds stock, so both narrow routes are
// registered ahead of the broad one they share a source and detail type with.
eventBridgeRouter
  .route(flagHighValueOrder)
  .route(processOrder)
  .route(archivePartnerOrder)
  .route(mirrorOrderUpdate)
  .route(updateOrder)
  .route(routeToLeedsWarehouse)
  .route(dispatchShipment)
  .route(settlePaymentLedger);
