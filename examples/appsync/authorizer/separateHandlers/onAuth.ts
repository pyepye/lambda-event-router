import type { AppSyncAuthorizerResult } from 'aws-lambda';

import type { AppSyncAuthorizerRequest } from '@lambda-event-router/appsync';

// Standalone AppSync Lambda authorizer handler.
// Receives flattened fields from the AppSync authorizer event.
export async function onAuth(
  request: AppSyncAuthorizerRequest,
): Promise<AppSyncAuthorizerResult<Record<string, unknown>>> {
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
}
