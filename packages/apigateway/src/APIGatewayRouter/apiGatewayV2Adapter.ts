import type {
  APIGatewayEventRequestContextIAMAuthorizer,
  APIGatewayEventRequestContextJWTAuthorizer,
  APIGatewayEventRequestContextLambdaAuthorizer,
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithIAMAuthorizer,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { isObject } from '@lambda-event-router/base';
import {
  type Auth,
  buildValueMaps,
  type FinalizedHTTPResponse,
  type HTTPAdapter,
  type NormalizedHTTPEvent,
} from '@lambda-event-router/http';

export type APIGatewayV2EventType =
  | APIGatewayProxyEventV2
  | APIGatewayProxyEventV2WithJWTAuthorizer
  | APIGatewayProxyEventV2WithIAMAuthorizer
  | APIGatewayProxyEventV2WithLambdaAuthorizer<unknown>;

type V2AuthorizerContext =
  | APIGatewayEventRequestContextJWTAuthorizer
  | APIGatewayEventRequestContextIAMAuthorizer
  | APIGatewayEventRequestContextLambdaAuthorizer<unknown>;

function isJWTAuthorizer(authorizer: V2AuthorizerContext): authorizer is APIGatewayEventRequestContextJWTAuthorizer {
  return 'jwt' in authorizer;
}

function isIAMAuthorizer(authorizer: V2AuthorizerContext): authorizer is APIGatewayEventRequestContextIAMAuthorizer {
  return 'iam' in authorizer;
}

function extractV2Auth(event: APIGatewayV2EventType): Auth | undefined {
  const { requestContext } = event;

  if ('authentication' in requestContext && requestContext.authentication) {
    return { clientCert: { ...requestContext.authentication.clientCert } };
  }

  if ('authorizer' in requestContext && requestContext.authorizer) {
    const { authorizer } = requestContext;

    if (isJWTAuthorizer(authorizer)) {
      return { claims: authorizer.jwt.claims, scopes: authorizer.jwt.scopes };
    }
    if (isIAMAuthorizer(authorizer)) {
      return { iam: authorizer.iam };
    }
    return { context: { ...authorizer } };
  }
  return undefined;
}

export const apiGatewayV2Adapter: HTTPAdapter<APIGatewayV2EventType, APIGatewayProxyResultV2> = {
  canHandleEvent(event: unknown): event is APIGatewayV2EventType {
    if (!isObject(event)) return false;
    if (typeof event.rawPath !== 'string') return false;
    if (!isObject(event.requestContext)) return false;
    if (!isObject(event.requestContext.http)) return false;
    if (typeof event.requestContext.http.method !== 'string') return false;
    // event.rawPath guards against ALBEvent, VPCLatticeV1, VPCLatticeV2, APIGatewayV1
    return true;
  },

  normalize(event: APIGatewayV2EventType): NormalizedHTTPEvent {
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
    };
  },
};
