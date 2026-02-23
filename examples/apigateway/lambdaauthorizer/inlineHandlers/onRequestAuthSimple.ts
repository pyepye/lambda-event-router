import { defineLambdaAuthorizerRoute } from '@lambda-event-router/apigateway';

// REQUEST authorizer (simple response) — returns true/false.
// The router wraps the boolean as { isAuthorized } for AWS API Gateway V2 simple mode.
// Filtered to GET requests only.
export const onRequestAuthSimpleRoute = defineLambdaAuthorizerRoute({
  filters: { type: 'REQUEST', method: 'GET' },
}).handle(async (request) => {
  const { headers } = request;

  const authHeader = headers?.authorization;

  if (!authHeader) {
    return false;
  }

  // e.g. verify the token is valid
  const isValid = authHeader.startsWith('Bearer ');

  return isValid;
});
