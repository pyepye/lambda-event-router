import {
  Allow,
  Deny,
  type LambdaAuthorizerResult,
  type LambdaAuthorizerTokenRequest,
} from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { REVOKED_TOKEN, SIMPLE_MODE_TOKEN, STAFF_TOKEN } from '../utils/constants.js';

// The REST API's TOKEN authorizer. Whatever it puts in the policy's context reaches the API handler
// as `auth.context`, and API Gateway sends every context value on as a string.
export async function authoriseStaffToken({
  authorizationToken,
  resourceArn,
}: LambdaAuthorizerTokenRequest): Promise<LambdaAuthorizerResult | boolean> {
  logger.info({ message: 'Staff token presented', tokenLength: authorizationToken.length });

  if (authorizationToken === STAFF_TOKEN) {
    return Allow('staff-4821', resourceArn, { department: 'goods-in', clearance: 3 });
  }

  if (authorizationToken === REVOKED_TOKEN) {
    throw Deny('anonymous', resourceArn);
  }

  // A TOKEN authorizer has no simple response shape, so the router refuses a boolean and the
  // invocation fails.
  if (authorizationToken === SIMPLE_MODE_TOKEN) {
    return true;
  }

  // An expired token, and anything else the warehouse does not issue, is denied.
  return Deny('anonymous', resourceArn);
}
