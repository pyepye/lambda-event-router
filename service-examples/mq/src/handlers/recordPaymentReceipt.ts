import { logger } from '@lambda-event-router/base';
import { defineRabbitMQRoute } from '@lambda-event-router/mq';

import { PAYMENT_QUEUES } from '../utils/brokers.js';
import { PaymentSchema } from '../utils/schemas.js';

// Receipts from the payment provider. The contentType filter is the only thing separating a receipt
// from anything else on the queue, so a receipt published without a content type reaches no route.
export const recordPaymentReceipt = defineRabbitMQRoute({
  filters: {
    queue: PAYMENT_QUEUES.receipts,
    contentType: 'application/json',
  },
  bodySchema: PaymentSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Payment receipt recorded',
    paymentId: request.body.paymentId,
    amount: request.body.amount,
  });
});
