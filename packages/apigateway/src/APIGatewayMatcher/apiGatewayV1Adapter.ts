import type {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    APIGatewayProxyWithCognitoAuthorizerEvent,
    APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda';

import { isObject } from '@latcher/base';
import {
    buildValueMaps,
    type FinalizedHTTPResponse,
    type HTTPAdapter,
    type NormalizedHTTPEvent,
} from '@latcher/http';

import {
    type APIGatewayAuth,
    type APIGatewayAuthorizer,
    type LambdaAuth,
    readApiKey,
    readClaims,
    readClientCert,
    readLambdaContext,
    readScopes,
    readV1Iam,
    withExtras,
} from './auth.js';

export type APIGatewayV1EventType =
  | APIGatewayProxyEvent
  | APIGatewayProxyWithCognitoAuthorizerEvent
  | APIGatewayProxyWithLambdaAuthorizerEvent<unknown>;

// HTTP API integration payload 1.0 carries a version, and REST carries none
function isHttpApiEvent(event: APIGatewayV1EventType): boolean {
  return isObject(event) && event.version === '1.0';
}

// REST sets principalId and integrationLatency itself, over any context keys of the same name
function readRestLambdaAuth(authorizer: Record<string, unknown>): LambdaAuth {
  const { principalId, integrationLatency, ...context } = authorizer;
  return {
    type: 'lambda',
    principalId: typeof principalId === 'string' ? principalId : undefined,
    context: readLambdaContext(context),
  };
}

// HTTP API adds claims and scopes as null, and never passes the authorizer's principalId
function readHttpLambdaAuth(authorizer: Record<string, unknown>): LambdaAuth {
  const { claims, scopes, ...context } = authorizer;
  return { type: 'lambda', principalId: undefined, context: readLambdaContext(context) };
}

function readV1Authorizer(event: APIGatewayV1EventType): APIGatewayAuthorizer | undefined {
  const { identity } = event.requestContext;
  const authorizer: unknown = event.requestContext.authorizer;
  const isHttpApi = isHttpApiEvent(event);

  if (isObject(authorizer)) {
    const claims = readClaims(authorizer.claims);
    if (claims && isHttpApi) return { type: 'jwt', claims, scopes: readScopes(authorizer.scopes) };
    if (claims) return { type: 'cognito', claims };
    return isHttpApi ? readHttpLambdaAuth(authorizer) : readRestLambdaAuth(authorizer);
  }

  const iam = readV1Iam(identity);
  return iam && { type: 'iam', iam };
}

function extractV1Auth(event: APIGatewayV1EventType): APIGatewayAuth {
  const { identity } = event.requestContext;
  return withExtras(readV1Authorizer(event), { apiKey: readApiKey(identity), clientCert: readClientCert(identity) });
}

export const apiGatewayV1Adapter: HTTPAdapter<APIGatewayV1EventType, APIGatewayProxyResult, APIGatewayAuth> = {
  canHandleEvent(event: unknown): event is APIGatewayV1EventType {
    if (!isObject(event)) return false;
    if (typeof event.path !== 'string') return false; // Guard against VPCLatticeV1, APIGatewayV2
    if (typeof event.httpMethod !== 'string') return false; // Guard against VPCLatticeV1, VPCLatticeV2
    if ('rawPath' in event) return false; // Guard against APIGatewayV2
    if (event.type === 'REQUEST' && typeof event.methodArn === 'string') return false; // Guard against a REQUEST Lambda authorizer event
    if (!isObject(event.requestContext)) return false;
    if (isObject(event.requestContext.elb)) return false; // Guard against ALBEvent
    // event.httpMethod guards against VPCLatticeV1, VPCLatticeV2
    // event.path guards against APIGatewayV2
    // event.requestContext.elb guards against ALBEvent
    return true;
  },

  normalize(event: APIGatewayV1EventType): NormalizedHTTPEvent<APIGatewayAuth> {
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
      isBase64Encoded: response.isBase64Encoded,
    };
  },
};
