import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/eventbridge';

import { SHIPMENT_DELAYED, SHIPMENT_DISPATCHED, SHIPPING_SOURCE } from '../config.js';
import { ShipmentSchema } from '../utils/schemas.js';

// Every other shipment event goes to the carrier feed. Two detail types share one route, which is
// what the list form of a filter is for.
export const dispatchShipment = defineRoute({
  filters: {
    source: SHIPPING_SOURCE,
    detailType: [SHIPMENT_DISPATCHED, SHIPMENT_DELAYED],
  },
  detailSchema: ShipmentSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Shipment sent to the carrier feed',
    orderRef: request.detail.orderRef,
    carrier: request.detail.carrier,
    trackingRef: request.detail.trackingRef,
    detailType: request.detailType,
  });
});
