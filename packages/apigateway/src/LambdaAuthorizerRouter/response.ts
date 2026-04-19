import type { APIGatewayAuthorizerResult } from 'aws-lambda';

export function isAuthorizerResponse(value: unknown): value is APIGatewayAuthorizerResult {
  if (typeof value !== 'object' || value === null) return false;
  if (!('principalId' in value && 'policyDocument' in value)) return false;
  return typeof value.principalId === 'string' && typeof value.policyDocument === 'object';
}

export function Allow(
  principalId: string,
  resource: string,
  context?: Record<string, string | number | boolean>,
): APIGatewayAuthorizerResult {
  const result: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: resource,
        },
      ],
    },
  };

  if (context) {
    result.context = context;
  }

  return result;
}

export function Deny(principalId: string, resource: string): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Deny',
          Resource: resource,
        },
      ],
    },
  };
}
