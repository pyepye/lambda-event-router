import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/kafka';

import { EVENT_TYPE_HEADER, ORDER_CREATED, ORDERS_TOPIC } from '../config.js';
import { CLUSTER_ARN } from '../environment.js';
import { withOrderContext } from '../middleware/withOrderContext.js';
import { OrderSchema } from '../utils/schemas.js';

// The normal path for a new order. eventSourceArn pins the route to this cluster, and the custom
// filter takes only the created events, so a cancellation on the same topic matches no route at all.
export const processOrder = defineRoute({
  filters: {
    topic: ORDERS_TOPIC,
    eventSourceArn: CLUSTER_ARN,
    custom: ({ headers }) => headers[EVENT_TYPE_HEADER] === ORDER_CREATED,
  },
  valueSchema: OrderSchema,
  middleware: [withOrderContext],
}).handle(async (request) => {
  logger.info({
    message: 'Order processed',
    orderId: request.value.orderId,
    total: request.value.total,
    currency: request.value.currency,
    partition: request.partition,
    offset: request.offset,
  });
});
