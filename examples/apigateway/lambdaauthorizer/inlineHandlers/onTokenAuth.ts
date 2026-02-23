import { defineLambdaAuthorizerRoute, generatePolicy } from '@lambda-event-router/apigateway';

// TOKEN authorizer — invoked with authorizationToken from the configured token source header.
// Returns an IAM policy via generatePolicy() helper.
export const onTokenAuthRoute = defineLambdaAuthorizerRoute({
  filters: { type: 'TOKEN' },
}).handle(async (request) => {
  const { authorizationToken, resourceArn } = request;

  // Token source header value arrives as-is, e.g. "Bearer eyJ..."
  const [scheme, token] = authorizationToken.split(' ');
  const isBearerScheme = scheme === 'Bearer';

  if (!(isBearerScheme && token)) {
    return generatePolicy('anonymous', 'Deny', resourceArn);
  }

  // e.g. verify JWT, look up session, etc.
  console.log(`Validated token for resourceArn: ${resourceArn}`);

  return generatePolicy('user-123', 'Allow', resourceArn);
});
