import { createStepFunctionsRouter } from '@lambda-event-router/stepfunctions';

import { approveFraudReview } from './handlers/approveFraudReview.js';
import { chargePayment } from './handlers/chargePayment.js';
import { failUnknownCallback } from './handlers/failUnknownCallback.js';
import { releaseStockHold } from './handlers/releaseStockHold.js';
import { reserveStock } from './handlers/reserveStock.js';
import { logTask } from './middleware/logTask.js';

export const stepFunctionsRouter = createStepFunctionsRouter({
  middleware: [logTask],
});

// Order matters: failUnknownCallback matches any payload carrying a TaskToken, so it has to sit
// after approveFraudReview or it would claim every callback.
stepFunctionsRouter
  .route(reserveStock)
  .route(chargePayment)
  .route(approveFraudReview)
  .route(releaseStockHold)
  .route(failUnknownCallback);
