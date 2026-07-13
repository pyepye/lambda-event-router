import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/kafka';

import { ORDERS_TOPIC, PRIORITY_HEADER, URGENT_PRIORITY } from '../config.js';
import { OrderSchema } from '../utils/schemas.js';

// An urgent order skips the normal path.
// Registered before processOrder so an urgent order wins here rather than there.
export const escalateUrgentOrder = defineRoute({
  filters: {
    topic: ORDERS_TOPIC,
    custom: ({ headers }) => headers[PRIORITY_HEADER] === URGENT_PRIORITY,
  },
  valueSchema: OrderSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Urgent order escalated',
    orderId: request.value.orderId,
    total: request.value.total,
    partition: request.partition,
    offset: request.offset,
  });
});
