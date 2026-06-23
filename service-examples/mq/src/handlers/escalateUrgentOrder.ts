import { logger } from '@lambda-event-router/base';
import { defineActiveMQRoute } from '@lambda-event-router/mq';

import { ORDER_BROKER_ARN } from '../config.js';
import { withOrderContext } from '../middleware/withOrderContext.js';
import { ORDER_QUEUES } from '../utils/brokers.js';
import { OrderSchema } from '../utils/schemas.js';

// An urgent order skips the normal run. The custom filter reads a JMS property, which the publisher
// sets as a STOMP header. Registered ahead of processOrder so an urgent order wins here.
export const escalateUrgentOrder = defineActiveMQRoute({
  filters: {
    eventSourceArn: ORDER_BROKER_ARN,
    destination: ORDER_QUEUES.events,
    messageType: 'jms/text-message',
    custom: ({ message }) => message.properties.orderPriority === 'urgent',
  },
  bodySchema: OrderSchema,
  middleware: [withOrderContext],
}).handle(async (request) => {
  logger.info({
    message: 'Urgent order escalated',
    orderId: request.body.orderId,
    total: request.body.total, // converted by the schema
    currency: request.body.currency,
  });
});
