import { logger } from '@lambda-event-router/base';
import { defineActiveMQRoute } from '@lambda-event-router/mq';

import { LEGACY_ORDER_BROKER_ARN } from '../config.js';
import { ORDER_QUEUES } from '../utils/brokers.js';
import { OrderSchema } from '../utils/schemas.js';

// Fulfilment still runs on a second broker while the orders team migrates off it. Its filters are
// escalateUrgentOrder's with a different broker ARN, and it is registered first, so an urgent order
// reaching escalateUrgentOrder is what proves the eventSourceArn filter rejected this route.
export const routeToLegacyFulfilment = defineActiveMQRoute({
  filters: {
    eventSourceArn: LEGACY_ORDER_BROKER_ARN,
    destination: ORDER_QUEUES.events,
    messageType: 'jms/text-message',
    custom: ({ message }) => message.properties.orderPriority === 'urgent',
  },
  bodySchema: OrderSchema,
}).handle(async (request) => {
  logger.info({ message: 'Order sent to legacy fulfilment', orderId: request.body.orderId });
});
