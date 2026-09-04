import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithIAMAuthorizer,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { isObject } from '@lambda-event-router/base';
import {
  buildValueMaps,
  type FinalizedHTTPResponse,
  type HTTPAdapter,
  type NormalizedHTTPEvent,
} from '@lambda-event-router/http';

import {
  type APIGatewayAuth,
  type APIGatewayAuthorizer,
  readClaims,
  readClientCert,
  readLambdaContext,
  readScopes,
  readV2Iam,
  withExtras,
} from './auth.js';

export type APIGatewayV2EventType =
  | APIGatewayProxyEventV2
  | APIGatewayProxyEventV2WithJWTAuthorizer
  | APIGatewayProxyEventV2WithIAMAuthorizer
  | APIGatewayProxyEventV2WithLambdaAuthorizer<unknown>;

function readV2Authorizer(authorizer: unknown): APIGatewayAuthorizer | undefined {
  if (!isObject(authorizer)) return undefined;

  if (isObject(authorizer.jwt)) {
    const claims = readClaims(authorizer.jwt.claims) ?? {};
    return { type: 'jwt', claims, scopes: readScopes(authorizer.jwt.scopes) };
  }

  const iam = readV2Iam(authorizer.iam);
  if (iam) return { type: 'iam', iam };

  // A Lambda authorizer that returns no context arrives as lambda: null
  if (Object.hasOwn(authorizer, 'lambda')) {
    const context = isObject(authorizer.lambda) ? readLambdaContext(authorizer.lambda) : {};
    return { type: 'lambda', principalId: undefined, context };
  }

  return undefined;
}

function extractV2Auth(event: APIGatewayV2EventType): APIGatewayAuth {
  const { requestContext } = event;
  const authorizer = 'authorizer' in requestContext ? requestContext.authorizer : undefined;
  const authentication = 'authentication' in requestContext ? requestContext.authentication : undefined;
  return withExtras(readV2Authorizer(authorizer), { clientCert: readClientCert(authentication) });
}

export const apiGatewayV2Adapter: HTTPAdapter<APIGatewayV2EventType, APIGatewayProxyResultV2, APIGatewayAuth> = {
  canHandleEvent(event: unknown): event is APIGatewayV2EventType {
    if (!isObject(event)) return false;
    if (typeof event.rawPath !== 'string') return false;
    if (event.type === 'REQUEST' && typeof event.routeArn === 'string') return false; // Guard against a REQUEST Lambda authorizer event
    if (!isObject(event.requestContext)) return false;
    if (!isObject(event.requestContext.http)) return false;
    if (typeof event.requestContext.http.method !== 'string') return false;
    // event.rawPath guards against ALBEvent, VPCLatticeV1, VPCLatticeV2, APIGatewayV1
    return true;
  },

  normalize(event: APIGatewayV2EventType): NormalizedHTTPEvent<APIGatewayAuth> {
    // API Gateway V2 sends no multi-value form: it comma-joins repeated headers and query params
    // into one string before invoking the lambda. The multi-value map therefore holds that single
    // joined string; it is not split back apart, since a value may legitimately contain a comma.
    const headers = buildValueMaps({ single: event.headers, lowercaseKeys: true });
    const query = buildValueMaps({ single: event.queryStringParameters });

    return {
      method: event.requestContext.http.method,
      path: event.rawPath,
      headers: headers.flat,
      multiValueHeaders: headers.multiValue,
      query: query.flat,
      multiValueQuery: query.multiValue,
      body: event.body,
      isBase64Encoded: event.isBase64Encoded,
      auth: extractV2Auth(event),
    };
  },

  buildResult(response: FinalizedHTTPResponse): APIGatewayProxyResultV2 {
    return {
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers,
      isBase64Encoded: response.isBase64Encoded,
    };
  },
};
