import { defineAuthorizerRoute } from '@lambda-event-router/appsync';
// AppSync Lambda authorizer - validates the authorization token and returns an auth decision.
// Receives flattened fields from the AppSync authorizer event.
export const onAuthRoute = defineAuthorizerRoute().handle(async (request) => {
  const { authorizationToken, requestHeaders, apiId, operationName } = request;

  // operationName contains the GraphQL operation name (e.g. "GetUser", "CreateUser")
  // Can be used for operation-level authorization decisions
  console.log(`Operation: ${operationName}`);

  // e.g. "Bearer eyJ..." or a custom token format
  const [scheme, token] = authorizationToken.split(' ');
  const isBearerScheme = scheme === 'Bearer';

  if (!(isBearerScheme && token)) {
    return { isAuthorized: false };
  }

  // e.g. verify JWT, check token against a data store
  console.log(`Authorizing request for API ${apiId}`);
  console.log(`Origin header: ${requestHeaders?.origin}`);

  return {
    isAuthorized: true,
    resolverContext: {
      userId: 'user-123',
      role: 'admin',
    },
    deniedFields: [],
    ttlOverride: 300,
  };
});
