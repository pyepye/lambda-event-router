import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/kafka';

import { PAYMENTS_TOPIC } from '../config.js';
import { PRIMARY_BOOTSTRAP_SERVER } from '../environment.js';
import { PaymentSchema } from '../utils/schemas.js';

// Captures are matched by a broker address rather than by the cluster ARN, which is the other string
// filter the router offers. Lambda reports every broker on the event and the filter matches any one
// of them.
export const capturePayment = defineRoute({
  filters: {
    topic: PAYMENTS_TOPIC,
    bootstrapServer: PRIMARY_BOOTSTRAP_SERVER,
  },
  valueSchema: PaymentSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Payment captured',
    paymentId: request.value.paymentId,
    orderId: request.value.orderId,
    amount: request.value.amount,
    partition: request.partition,
    offset: request.offset,
  });
});
