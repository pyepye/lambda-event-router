import type {
  APIGatewayEventDefaultAuthorizerContext,
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyCognitoAuthorizer,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayProxyWithCognitoAuthorizerEvent,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda';

import { isObject } from '@lambda-event-router/base';
import {
  type Auth,
  buildValueMaps,
  type FinalizedHTTPResponse,
  type HTTPAdapter,
  type NormalizedHTTPEvent,
} from '@lambda-event-router/http';

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

function extractV1Auth(event: APIGatewayV1EventType): Auth | undefined {
  const { requestContext } = event;
  /* v8 ignore next -- @preserve - Guard is for TS. API Gateway V1 always provides requestContext.identity */
  if (requestContext.identity) {
    const { identity } = requestContext;
    if (identity.apiKey) {
      return { apiKey: identity.apiKey, apiKeyId: identity.apiKeyId ?? undefined };
    }
    if (identity.cognitoAuthenticationType === 'authenticated' && identity.cognitoIdentityId) {
      return {
        iam: {
          cognitoIdentityId: identity.cognitoIdentityId,
          cognitoIdentityPoolId: identity.cognitoIdentityPoolId,
          accountId: identity.accountId,
          caller: identity.caller,
          sourceIp: identity.sourceIp,
          userArn: identity.userArn,
        },
      };
    }
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
    if (typeof event.path !== 'string') return false; // Guard against VPCLatticeV1, APIGatewayV2
    if (typeof event.httpMethod !== 'string') return false; // Guard against VPCLatticeV1, VPCLatticeV2
    if ('rawPath' in event) return false; // Guard against APIGatewayV2
    if (!isObject(event.requestContext)) return false;
    if (isObject(event.requestContext.elb)) return false; // Guard against ALBEvent
    // event.httpMethod guards against VPCLatticeV1, VPCLatticeV2
    // event.path guards against APIGatewayV2
    // event.requestContext.elb guards against ALBEvent
    return true;
  },

  normalize(event: APIGatewayV1EventType): NormalizedHTTPEvent {
    // API Gateway V1 sends both the single-value and multi-value forms; read both so a repeated
    // query param or header is not lost when the flat map keeps only the last value.
    const headers = buildValueMaps({
      single: event.headers,
      multi: event.multiValueHeaders,
      lowercaseKeys: true,
    });
    const query = buildValueMaps({
      single: event.queryStringParameters,
      multi: event.multiValueQueryStringParameters,
    });

    return {
      method: event.httpMethod,
      path: event.path,
      headers: headers.flat,
      multiValueHeaders: headers.multiValue,
      query: query.flat,
      multiValueQuery: query.multiValue,
      body: event.body ?? undefined,
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
