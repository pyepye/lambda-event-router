import {
  Allow,
  Deny,
  type LambdaAuthorizerRequestRequest,
  type LambdaAuthorizerResult,
} from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { SERVICE_TOKEN } from '../utils/constants.js';

// The HTTP API's policy-mode authorizer, reached by the PATCH filter. Policy mode runs on authorizer
// payload format 1.0, so this route receives the same event shape as a REST API authorizer.
export async function authoriseStockReconciliation({
  headers,
  resourceArn,
}: LambdaAuthorizerRequestRequest): Promise<LambdaAuthorizerResult> {
  if (headers.authorization !== SERVICE_TOKEN) {
    logger.info({ message: 'Reconciliation refused' });
    return Deny('anonymous', resourceArn);
  }

  logger.info({ message: 'Reconciliation allowed' });

  return Allow('stock-service', resourceArn, { costCentre: 'inventory', shift: 'nights' });
}
