import type { LambdaAuthorizerTokenRequest } from '@lambda-event-router/apigateway';
import { generatePolicy } from '@lambda-event-router/apigateway';
import type { APIGatewayAuthorizerResult } from 'aws-lambda';

// Standalone TOKEN authorizer handler.
// Receives authorizationToken (raw value from the token source header) and methodArn.
export async function onTokenAuth(request: LambdaAuthorizerTokenRequest): Promise<APIGatewayAuthorizerResult> {
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
}
