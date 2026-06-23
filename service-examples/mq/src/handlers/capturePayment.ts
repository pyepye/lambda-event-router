import { logger } from '@lambda-event-router/base';
import { defineRabbitMQRoute } from '@lambda-event-router/mq';

import { DEFAULT_VIRTUAL_HOST } from '../config.js';
import { PAYMENT_QUEUES } from '../utils/brokers.js';
import { PaymentSchema } from '../utils/schemas.js';

// The normal run. The queue key in the event is `payment-events::/`, and the router splits it, so the
// queue filter reads the name and the virtualHost filter reads the host.
export const capturePayment = defineRabbitMQRoute({
  filters: {
    queue: PAYMENT_QUEUES.events,
    virtualHost: DEFAULT_VIRTUAL_HOST,
    contentType: 'application/json',
  },
  bodySchema: PaymentSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Payment captured',
    paymentId: request.body.paymentId,
    orderId: request.body.orderId,
    amount: request.body.amount,
  });
});
