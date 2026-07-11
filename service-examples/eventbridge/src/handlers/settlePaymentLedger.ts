import { defineRoute } from '@lambda-event-router/eventbridge';

import { PAYMENT_CAPTURED, PAYMENTS_SOURCE } from '../config.js';
import { PaymentCapturedSchema } from '../utils/schemas.js';

// Ledger settlement always throws, which is the only route here that fails inside the handler
// rather than on its schema. The distinction shows in the log: the middleware chain has already run
// by the time the handler throws, so this event has a logEvent line. An event that fails validation
// has none.
export const settlePaymentLedger = defineRoute({
  filters: {
    source: PAYMENTS_SOURCE,
    detailType: PAYMENT_CAPTURED,
  },
  detailSchema: PaymentCapturedSchema,
}).handle(async (request) => {
  throw new Error(`Ledger service unavailable for payment ${request.detail.paymentRef}`);
});
