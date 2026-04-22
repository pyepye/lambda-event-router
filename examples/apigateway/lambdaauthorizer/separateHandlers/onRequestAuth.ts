import type { APIGatewayAuthorizerResult } from 'aws-lambda';

import type { LambdaAuthorizerRequestRequest } from '@lambda-event-router/apigateway';
import { generatePolicy } from '@lambda-event-router/apigateway';

// Standalone REQUEST authorizer handler (IAM policy response).
// Uses normalized headers, query, method, and path across V1/V2.
export async function onRequestAuth(request: LambdaAuthorizerRequestRequest): Promise<APIGatewayAuthorizerResult> {
  const { headers, query, method, path, resourceArn } = request;

  const authHeader = headers?.authorization;
  const apiKey = query?.apiKey;

  if (!(authHeader || apiKey)) {
    return generatePolicy('anonymous', 'Deny', resourceArn);
  }

  // e.g. validate credentials, check API key against a data store
  console.log(`Authorizing ${method} ${path} with header: ${authHeader}, apiKey: ${apiKey}`);

  return generatePolicy('user-456', 'Allow', resourceArn);
}
