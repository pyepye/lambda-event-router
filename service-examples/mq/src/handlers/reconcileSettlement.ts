import { logger } from '@lambda-event-router/base';
import { defineRabbitMQRoute } from '@lambda-event-router/mq';

import { SETTLEMENT_VIRTUAL_HOST } from '../config.js';
import { PAYMENT_QUEUES } from '../utils/brokers.js';
import { PaymentSchema } from '../utils/schemas.js';

// Reconciliation reads the same queue on a virtual host of its own. The broker only serves the
// default host, so this route is skipped on the virtualHost filter and capturePayment takes the
// message instead.
export const reconcileSettlement = defineRabbitMQRoute({
  filters: {
    queue: PAYMENT_QUEUES.events,
    virtualHost: SETTLEMENT_VIRTUAL_HOST,
  },
  bodySchema: PaymentSchema,
}).handle(async (request) => {
  logger.info({ message: 'Payment reconciled', paymentId: request.body.paymentId });
});
