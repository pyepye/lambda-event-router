import { createLambdaAuthorizerMatcher } from '@latcher/apigateway';

import { authoriseStaffToken } from './handlers/authoriseStaffToken.js';
import { authoriseStockAdjustment } from './handlers/authoriseStockAdjustment.js';
import { authoriseStockReconciliation } from './handlers/authoriseStockReconciliation.js';
import { authoriseWarehouseRead } from './handlers/authoriseWarehouseRead.js';
import { logAuthorizerAttempt } from './middleware/logAuthorizerAttempt.js';
import { withAuditTrail } from './middleware/withAuditTrail.js';

export const authorizerMatcher = createLambdaAuthorizerMatcher({ middleware: [logAuthorizerAttempt] });

// The two method-filtered routes are registered before the read route, whose custom filter would
// otherwise be asked about every REQUEST event.
authorizerMatcher
  .token({ middleware: [withAuditTrail], handler: authoriseStaffToken })
  .request({ method: 'PUT', handler: authoriseStockAdjustment })
  .request({ method: 'PATCH', handler: authoriseStockReconciliation })
  .route(authoriseWarehouseRead);
