import { createLambdaAuthorizerRouter } from '@lambda-event-router/apigateway';

import { authoriseStaffToken } from './handlers/authoriseStaffToken.js';
import { authoriseStockAdjustment } from './handlers/authoriseStockAdjustment.js';
import { authoriseStockReconciliation } from './handlers/authoriseStockReconciliation.js';
import { authoriseWarehouseRead } from './handlers/authoriseWarehouseRead.js';
import { logAuthorizerAttempt } from './middleware/logAuthorizerAttempt.js';
import { withAuditTrail } from './middleware/withAuditTrail.js';

export const authorizerRouter = createLambdaAuthorizerRouter({ middleware: [logAuthorizerAttempt] });

// The two method-filtered routes are registered before the read route, whose custom filter would
// otherwise be asked about every REQUEST event.
authorizerRouter
  .token({ middleware: [withAuditTrail], handler: authoriseStaffToken })
  .request({ method: 'PUT', handler: authoriseStockAdjustment })
  .request({ method: 'PATCH', handler: authoriseStockReconciliation })
  .route(authoriseWarehouseRead);
