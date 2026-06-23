import { createRabbitMQRouter } from '@lambda-event-router/mq';

import { capturePayment } from './handlers/capturePayment.js';
import { holdPaymentForReview } from './handlers/holdPaymentForReview.js';
import { reconcileSettlement } from './handlers/reconcileSettlement.js';
import { recordPaymentNote } from './handlers/recordPaymentNote.js';
import { recordPaymentReceipt } from './handlers/recordPaymentReceipt.js';
import { routeToLegacySettlement } from './handlers/routeToLegacySettlement.js';
import { settleHighValuePayment } from './handlers/settleHighValuePayment.js';
import { logPaymentMessage } from './middleware/logPaymentMessage.js';
import { PAYMENT_QUEUES } from './utils/brokers.js';

export const rabbitMqRouter = createRabbitMQRouter({ middleware: [logPaymentMessage] });

// The first two routes are the ones a payment never reaches: routeToLegacySettlement is skipped on
// the broker ARN and reconcileSettlement on the virtual host. capturePayment taking the message is
// what shows both filters rejected. settleHighValuePayment then sits ahead of capturePayment so a
// high priority payment wins there.
rabbitMqRouter
  .route(routeToLegacySettlement)
  .route(reconcileSettlement)
  .route(settleHighValuePayment)
  .route(capturePayment)
  .route({
    filters: { queue: PAYMENT_QUEUES.events, contentType: 'text/plain' },
    handler: recordPaymentNote,
  })
  .route(recordPaymentReceipt)
  .route(holdPaymentForReview);
