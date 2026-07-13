import { createKafkaRouter } from '@lambda-event-router/kafka';

import { capturePayment } from './handlers/capturePayment.js';
import { escalateUrgentOrder } from './handlers/escalateUrgentOrder.js';
import { processOrder } from './handlers/processOrder.js';
import { quarantineFailedRecord } from './handlers/quarantineFailedRecord.js';
import { refundPayment } from './handlers/refundPayment.js';
import { logRecord } from './middleware/logRecord.js';

export const kafkaRouter = createKafkaRouter({
  batchItemFailures: true,
  middleware: [logRecord],
});

// Order matters twice. escalateUrgentOrder's header filter has to win over processOrder for an urgent
// order, and refundPayment's over capturePayment for a refund.
kafkaRouter
  .route(escalateUrgentOrder)
  .route(processOrder)
  .route(refundPayment)
  .route(capturePayment)
  .route(quarantineFailedRecord);
