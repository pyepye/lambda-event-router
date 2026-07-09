import { createCloudWatchLogsRouter } from '@lambda-event-router/cloudwatch';

import { CHECKOUT_LOG_GROUP } from './config.js';
import { archivePaymentTraffic } from './handlers/archivePaymentTraffic.js';
import { escalateCheckoutFailure } from './handlers/escalateCheckoutFailure.js';
import { forwardAuditToSiem } from './handlers/forwardAuditToSiem.js';
import { indexCheckoutTraffic } from './handlers/indexCheckoutTraffic.js';
import { quarantineDeclinedPayment } from './handlers/quarantineDeclinedPayment.js';
import { logDelivery } from './middleware/logDelivery.js';

export const cloudwatchRouter = createCloudWatchLogsRouter({
  middleware: [logDelivery],
});

// Order matters twice over. escalateCheckoutFailure has to beat indexCheckoutTraffic on a checkout
// error delivery, and quarantineDeclinedPayment has to beat archivePaymentTraffic on a payments
// delivery carrying a decline.
cloudwatchRouter
  .route(escalateCheckoutFailure)
  .dataMessage({ filters: { logGroup: CHECKOUT_LOG_GROUP }, handler: indexCheckoutTraffic })
  .route(quarantineDeclinedPayment)
  .route(archivePaymentTraffic)
  .route(forwardAuditToSiem);
