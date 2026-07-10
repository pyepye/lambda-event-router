import { isObject, logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/stepfunctions';

import { RESERVE_STOCK_TASK } from '../config.js';
import { withOrderContext } from '../middleware/withOrderContext.js';
import { ReserveStockSchema } from '../utils/schemas.js';

// Holds stock for an order line. The returned object becomes the task result in the execution output.
// Stock is reserved inline rather than through a callback, so the filter turns down any payload
// carrying a TaskToken.
export const reserveStock = defineRoute({
  filters: {
    taskToken: false,
    custom: ({ event }) => isObject(event) && event.task === RESERVE_STOCK_TASK,
  },
  eventSchema: ReserveStockSchema,
  middleware: [withOrderContext],
}).handle(async (request) => {
  const reservationId = `RES-${request.event.orderId}`;

  logger.info({
    message: 'Stock reserved',
    orderId: request.event.orderId,
    reservationId,
    quantity: request.event.quantity,
  });

  return {
    step: 'reserveStock',
    reservationId,
    sku: request.event.sku,
    quantity: request.event.quantity,
    warehouse: 'LDN-1',
  };
});
