import type { LambdaAuthorizerRequestRequest } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { SERVICE_TOKEN } from '../utils/constants.js';

// The HTTP API's simple-response authorizer, reached by the PUT filter. A boolean is the whole
// answer, so this route cannot attach a context to the request.
export async function authoriseStockAdjustment({ headers, method }: LambdaAuthorizerRequestRequest): Promise<boolean> {
  const authorised = headers.authorization === SERVICE_TOKEN;

  logger.info({ message: 'Service call checked', method, authorised });

  return authorised;
}
