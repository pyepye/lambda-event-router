import type { ALBEvent, ALBResult } from 'aws-lambda';

import { isObject } from '@lambda-event-router/base';
import {
  buildValueMaps,
  type FinalizedHTTPResponse,
  type HTTPAdapter,
  type NormalizedHTTPEvent,
} from '@lambda-event-router/http';

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
    // ALB sends the multi-value form only when the target group has multi-value headers enabled,
    // and the single-value form otherwise. Read both so query and headers survive either mode.
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
