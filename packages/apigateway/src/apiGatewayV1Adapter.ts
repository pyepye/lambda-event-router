import { isObject } from '@lambda-event-router/base';
import type { Auth, FinalizedHTTPResponse, HTTPAdapter, NormalizedHTTPEvent } from '@lambda-event-router/http';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

function flattenHeaders(event: APIGatewayProxyEvent): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};

  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      headers[key.toLowerCase()] = value;
    }
  }

  if (event.multiValueHeaders) {
    // TODO: This is not how we should handle this, should we have multiValueHeaders as another property?
    for (const [key, values] of Object.entries(event.multiValueHeaders)) {
      if (values && values.length > 0) {
        const lastValue = values[values.length - 1];
        headers[key.toLowerCase()] = lastValue;
      }
    }
  }

  return headers;
}

// TODO: Use correct event event types here not just the single APIGatewayProxyEvent
function extractV1Auth(event: APIGatewayProxyEvent): Auth | undefined {
  const { requestContext } = event;

  if (
    requestContext.identity?.cognitoAuthenticationType === 'authenticated' &&
    requestContext.identity.cognitoIdentityId
  ) {
    return {
      iam: {
        cognitoIdentityId: requestContext.identity.cognitoIdentityId,
        cognitoIdentityPoolId: requestContext.identity.cognitoIdentityPoolId,
        accountId: requestContext.identity.accountId,
        caller: requestContext.identity.caller,
        sourceIp: requestContext.identity.sourceIp,
        userArn: requestContext.identity.userArn,
      },
    };
  }

  if (requestContext.authorizer) {
    const { authorizer } = requestContext;

    // Cognito User Pool authorizer — claims are nested under authorizer.claims
    if ('claims' in authorizer && authorizer.claims) {
      return { claims: authorizer.claims as Record<string, unknown> };
    }

    // Lambda authorizer — principalId + context
    if ('principalId' in authorizer) {
      const { principalId, ...context } = authorizer;
      return {
        principalId: principalId as string,
        context: context as Record<string, unknown>,
      };
    }

    return { context: authorizer as Record<string, unknown> };
  }

  return undefined;
}

export function canHandleV1Event(event: unknown): event is APIGatewayProxyEvent {
  if (!isObject(event)) return false;
  if (typeof event.httpMethod !== 'string') return false;
  if (typeof event.path !== 'string') return false;
  if (!isObject(event.requestContext)) return false;
  // V1 events do NOT have rawPath — distinguish from V2
  if ('rawPath' in event) return false;
  return true;
}

export const apiGatewayV1Adapter: HTTPAdapter<APIGatewayProxyEvent, APIGatewayProxyResult> = {
  canHandleEvent: canHandleV1Event,

  normalize(event: APIGatewayProxyEvent): NormalizedHTTPEvent {
    return {
      method: event.httpMethod,
      path: event.path,
      headers: flattenHeaders(event),
      query: (event.queryStringParameters ?? {}) as Record<string, string | undefined>,
      body: event.body ?? undefined,
      // TODO: Lets remove this. We should just decode if we can so the end user does not need to care
      isBase64Encoded: event.isBase64Encoded,
      auth: extractV1Auth(event),
    };
  },

  buildResult(response: FinalizedHTTPResponse): APIGatewayProxyResult {
    return {
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers,
    };
  },
};
