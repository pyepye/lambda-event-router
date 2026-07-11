import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/eventbridge';

import { LEEDS_WAREHOUSE_PATTERN, SHIPMENT_DISPATCHED, SHIPPING_SOURCE } from '../config.js';

// Stock held in Leeds ships from a different depot, so the resource ARN alone decides this one.
// The route carries no detailSchema: nothing here reads the detail, so the raw event is enough.
// Registered before dispatchShipment, which matches the same source and detail type.
export const routeToLeedsWarehouse = defineRoute({
  filters: {
    source: SHIPPING_SOURCE,
    detailType: SHIPMENT_DISPATCHED,
    resource: LEEDS_WAREHOUSE_PATTERN,
  },
}).handle(async (request) => {
  logger.info({
    message: 'Shipment sent to the Leeds depot',
    warehouse: request.resources[0],
    detailType: request.detailType,
  });
});
