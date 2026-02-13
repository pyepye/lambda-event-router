import { isObject } from '@lambda-event-router/base';
import type { FinalizedHTTPResponse, HTTPAdapter, NormalizedHTTPEvent } from '@lambda-event-router/http';
import type { ALBEvent, ALBResult } from 'aws-lambda';

// Duplicated from packages/apigateway/src/apiGatewayV1Adapter.ts
function flattenHeaders(event: ALBEvent): NormalizedHTTPEvent['headers'] {
  const headers: Record<string, string | undefined> = {};

  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      headers[key.toLowerCase()] = value;
    }
  }

  if (event.multiValueHeaders) {
    // TODO: This is not how we should handle this, should we have multiValueHeaders as another property?
    // TODO: Should probably use flattenArrayValues if moved to http
    for (const [key, values] of Object.entries(event.multiValueHeaders)) {
      if (values && values.length > 0) {
        const lastValue = values[values.length - 1];
        headers[key.toLowerCase()] = lastValue;
      }
    }
  }
  return headers;
}

export const albAdapter: HTTPAdapter<ALBEvent, ALBResult> = {
  canHandleEvent(event: unknown): event is ALBEvent {
    if (!isObject(event)) return false;
    if (typeof event.path !== 'string') return false; // Guard against VPCLatticeV1, APIGatewayV2
    if (typeof event.httpMethod !== 'string') return false; // Guards against VPCLatticeV1
    if (!isObject(event.requestContext)) return false;
    if (!isObject(event.requestContext.elb)) return false; // Guards against APIGatewayV1
    if (typeof event.requestContext.serviceArn === 'string') return false;
    // event.path guards against VPCLatticeV1, APIGatewayV2
    // event.httpMethod guards against VPCLatticeV2
    // event.requestContext.elb guards against APIGatewayV1
    return true;
  },

  normalize(event: ALBEvent): NormalizedHTTPEvent {
    return {
      method: event.httpMethod,
      path: event.path,
      headers: flattenHeaders(event),
      query: event.queryStringParameters ?? {},
      body: event.body ?? undefined,
      isBase64Encoded: event.isBase64Encoded,
      auth: { targetGroupArn: event.requestContext.elb.targetGroupArn },
    };
  },

  buildResult(response: FinalizedHTTPResponse): ALBResult {
    return {
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers,
    };
  },
};
