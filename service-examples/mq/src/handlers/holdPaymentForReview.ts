import { defineRabbitMQRoute } from '@lambda-event-router/mq';

import { PAYMENT_QUEUES } from '../utils/brokers.js';
import { PaymentSchema } from '../utils/schemas.js';

// Payments the fraud check stopped, and payments the upstream system malformed. Holding either needs a
// case in the review system that this service cannot open, so the handler always throws. A malformed
// body fails the schema first and never reaches it.
export const holdPaymentForReview = defineRabbitMQRoute({
  filters: {
    queue: [PAYMENT_QUEUES.invalid, PAYMENT_QUEUES.reviews],
    contentType: 'application/json',
  },
  bodySchema: PaymentSchema,
}).handle(async (request) => {
  throw new Error(`Payment ${request.body.paymentId} needs a review case before it can be held`);
});
