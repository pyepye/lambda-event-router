import { isObject } from '@lambda-event-router/base';
import type { Auth, FinalizedHTTPResponse, HTTPAdapter, NormalizedHTTPEvent } from '@lambda-event-router/http';
import type {
  APIGatewayEventDefaultAuthorizerContext,
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyCognitoAuthorizer,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayProxyWithCognitoAuthorizerEvent,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda';

export type APIGatewayV1EventType =
  | APIGatewayProxyEvent
  | APIGatewayProxyWithCognitoAuthorizerEvent
  | APIGatewayProxyWithLambdaAuthorizerEvent<unknown>;

type V1AuthorizerContext =
  | APIGatewayEventDefaultAuthorizerContext
  | APIGatewayProxyCognitoAuthorizer
  | APIGatewayEventLambdaAuthorizerContext<unknown>;

function isCognitoAuthorizer(authorizer: V1AuthorizerContext): authorizer is APIGatewayProxyCognitoAuthorizer {
  return isObject(authorizer) && 'claims' in authorizer;
}

function isLambdaAuthorizer(
  authorizer: V1AuthorizerContext,
): authorizer is APIGatewayEventLambdaAuthorizerContext<unknown> {
  return isObject(authorizer) && 'principalId' in authorizer;
}

function flattenHeaders(event: APIGatewayV1EventType): Record<string, string | undefined> {
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

function extractV1Auth(event: APIGatewayV1EventType): Auth | undefined {
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

    if (isCognitoAuthorizer(authorizer)) {
      return { claims: authorizer.claims };
    }

    if (isLambdaAuthorizer(authorizer)) {
      const { principalId, integrationLatency, ...context } = authorizer;
      return {
        principalId,
        context,
      };
    }

    return { context: authorizer };
  }

  return undefined;
}

export const apiGatewayV1Adapter: HTTPAdapter<APIGatewayV1EventType, APIGatewayProxyResult> = {
  canHandleEvent(event: unknown): event is APIGatewayV1EventType {
    if (!isObject(event)) return false;
    if (typeof event.httpMethod !== 'string') return false;
    if (typeof event.path !== 'string') return false;
    if (!isObject(event.requestContext)) return false;
    // V1 events do NOT have rawPath — distinguish from V2
    if ('rawPath' in event) return false;
    return true;
  },

  normalize(event: APIGatewayV1EventType): NormalizedHTTPEvent {
    return {
      method: event.httpMethod,
      path: event.path,
      headers: flattenHeaders(event),
      query: event.queryStringParameters ?? {},
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
