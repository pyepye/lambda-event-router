import { createActiveMQRouter } from '@lambda-event-router/mq';

import { archiveOrderLabel } from './handlers/archiveOrderLabel.js';
import { escalateUrgentOrder } from './handlers/escalateUrgentOrder.js';
import { processOrder } from './handlers/processOrder.js';
import { quarantineOrder } from './handlers/quarantineOrder.js';
import { routeToLegacyFulfilment } from './handlers/routeToLegacyFulfilment.js';
import { logOrderMessage } from './middleware/logOrderMessage.js';
import { ORDER_QUEUES } from './utils/brokers.js';
import { OrderSchema } from './utils/schemas.js';

export const activeMqRouter = createActiveMQRouter({ middleware: [logOrderMessage] });

// Order matters twice over. routeToLegacyFulfilment carries escalateUrgentOrder's filters with a
// different broker ARN, so an urgent order landing on escalateUrgentOrder is what shows the ARN
// filter rejected the first route. escalateUrgentOrder then sits ahead of processOrder, so an urgent
// order wins there rather than on the plain text route.
activeMqRouter
  .route(routeToLegacyFulfilment)
  .route(escalateUrgentOrder)
  .textMessage({
    filters: { destination: ORDER_QUEUES.events },
    bodySchema: OrderSchema,
    handler: processOrder,
  })
  .bytesMessage({
    filters: { destination: ORDER_QUEUES.events },
    handler: archiveOrderLabel,
  })
  .route(quarantineOrder);
