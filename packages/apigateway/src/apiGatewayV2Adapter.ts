import { isObject } from '@lambda-event-router/base';
import type { Auth, FinalizedHTTPResponse, HTTPAdapter, NormalizedHTTPEvent } from '@lambda-event-router/http';
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

export function canHandleV2Event(event: unknown): event is APIGatewayV2EventType {
  if (!isObject(event)) return false;
  if (typeof event.rawPath !== 'string') return false;
  if (!isObject(event.requestContext)) return false;
  if (!isObject(event.requestContext.http)) return false;
  if (typeof event.requestContext.http.method !== 'string') return false;
  return true;
}

export const apiGatewayV2Adapter: HTTPAdapter<APIGatewayV2EventType, APIGatewayProxyResultV2> = {
  canHandleEvent: canHandleV2Event,

  normalize(event: APIGatewayV2EventType): NormalizedHTTPEvent {
    return {
      method: event.requestContext.http.method,
      path: event.rawPath,
      headers: event.headers,
      query: event.queryStringParameters ?? {},
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
