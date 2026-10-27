import { isObject, logger } from '@latcher/base';
import { defineRoute } from '@latcher/stepfunctions';

import { CHARGE_PAYMENT_TASK } from '../config.js';
import { ChargePaymentSchema } from '../utils/schemas.js';

// Captures the order total. The custom filter is async, which the matcher awaits before it matches.
export const chargePayment = defineRoute({
  filters: {
    custom: async ({ event }) => isObject(event) && event.task === CHARGE_PAYMENT_TASK,
  },
  eventSchema: ChargePaymentSchema,
}).handle(async (request) => {
  const paymentId = `PAY-${request.event.orderId}`;

  logger.info({
    message: 'Payment captured',
    orderId: request.event.orderId,
    paymentId,
    amountPence: request.event.amountPence,
  });

  return {
    step: 'chargePayment',
    paymentId,
    capturedPence: request.event.amountPence,
    currency: request.event.currency,
  };
});
