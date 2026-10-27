import { isObject, logger } from '@latcher/base';
import { defineRoute } from '@latcher/sns';

import { ORDERS_TOPIC_ARN } from '../config.js';
import { OrderSchema } from '../utils/schemas.js';

// Express orders skip the normal queue and go straight to the courier.
// The custom filter reads the raw body before any schema runs, so it guards with isObject.
// Registered before processOrder so an express order wins here rather than on the eventType filter.
export const expediteOrder = defineRoute({
  filters: {
    topicArn: ORDERS_TOPIC_ARN,
    custom: ({ body }) => isObject(body) && body.shippingSpeed === 'express',
  },
  bodySchema: OrderSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Order sent to the express courier',
    orderId: request.body.orderId,
    total: request.body.total,
  });
});
