import type { LambdaAuthorizerRequestRequest } from '@lambda-event-router/apigateway';

// Standalone REQUEST authorizer handler (simple response).
// Returns true/false — the router wraps as { isAuthorized } for AWS API Gateway V2 simple mode.
// All headers should be set to lowercase
export async function onRequestAuthSimple(request: LambdaAuthorizerRequestRequest): Promise<boolean> {
  const { headers } = request;

  const authHeader = headers?.authorization;

  if (!authHeader) {
    return false;
  }

  // e.g. verify the token is valid
  const isValid = authHeader.startsWith('Bearer ');

  return isValid;
}
