import { defineRoute } from '@lambda-event-router/kafka';

import { PAYMENT_KIND_HEADER, PAYMENTS_TOPIC, REFUND_KIND } from '../config.js';
import { PaymentSchema } from '../utils/schemas.js';

// Refunds always throw, which is the only route that fails inside the handler rather than on its
// schema. The distinction shows in the logs: the middleware chain has already run by the time the
// handler throws, so this record has a `Handling Kafka record` line. A record that fails validation
// has none.
export const refundPayment = defineRoute({
  filters: {
    topic: PAYMENTS_TOPIC,
    custom: ({ headers }) => headers.some((header) => header[PAYMENT_KIND_HEADER] === REFUND_KIND),
  },
  valueSchema: PaymentSchema,
}).handle(async (request) => {
  throw new Error(`Refund gateway unavailable for payment ${request.value.paymentId}`);
});
