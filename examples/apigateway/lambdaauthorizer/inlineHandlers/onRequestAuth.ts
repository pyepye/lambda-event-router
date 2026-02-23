import { defineLambdaAuthorizerRoute, generatePolicy } from '@lambda-event-router/apigateway';

// REQUEST authorizer (IAM policy response) — invoked with headers, query params, etc.
// Normalized across V1 and V2 request events.
export const onRequestAuthRoute = defineLambdaAuthorizerRoute({
  filters: { type: 'REQUEST' },
}).handle(async (request) => {
  const { headers, query, resourceArn } = request;

  const authHeader = headers?.authorization;
  const apiKey = query?.apiKey;

  if (!(authHeader || apiKey)) {
    return generatePolicy('anonymous', 'Deny', resourceArn);
  }

  // e.g. validate credentials, check API key against a data store
  console.log(`Authorizing request with header: ${authHeader}, apiKey: ${apiKey}`);

  return generatePolicy('user-456', 'Allow', resourceArn);
});
