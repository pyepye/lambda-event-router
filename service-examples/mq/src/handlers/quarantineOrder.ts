import { defineActiveMQRoute } from '@lambda-event-router/mq';

import { ORDER_QUEUES } from '../utils/brokers.js';
import { OrderSchema } from '../utils/schemas.js';

// Orders the storefront could not place. Quarantining one needs a fulfilment hold that this service
// cannot take, so the handler always throws. The route is the only one for its destination and it is
// pinned to text, so a bytes message on the same queue reaches no route at all.
export const quarantineOrder = defineActiveMQRoute({
  filters: {
    destination: ORDER_QUEUES.invalid,
    messageType: 'jms/text-message',
  },
  bodySchema: OrderSchema,
}).handle(async (request) => {
  throw new Error(`Order ${request.body.orderId} needs a fulfilment hold before it can be quarantined`);
});
