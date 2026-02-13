import { isObject } from '@lambda-event-router/base';
import type { FinalizedHTTPResponse, HTTPAdapter, HttpMethod, NormalizedHTTPEvent } from '@lambda-event-router/http';

export interface VPCLatticeEventBase {
  method: HttpMethod;
  body?: string;
}

// TODO: This needs confirming - Can we use AWS Powertools types here?
export interface VPCLatticeEventV1 extends VPCLatticeEventBase {
  raw_path: string;
  headers?: Record<string, string>;
  query_string_parameters?: Record<string, string>;
  is_base64_encoded: boolean;
}

// TODO: This needs confirming
export interface VPCLatticeResult {
  statusCode: number;
  body?: string;
  isBase64Encoded?: boolean;
  headers?: Record<string, string>;
}

function flattenHeaders(event: VPCLatticeEventV1): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      headers[key.toLowerCase()] = value;
    }
  }
  return headers;
}

export const vpcLatticeV1Adapter: HTTPAdapter<VPCLatticeEventV1, VPCLatticeResult> = {
  canHandleEvent(event: unknown): event is VPCLatticeEventV1 {
    // TODO: This needs confirming
    if (!isObject(event)) return false;
    if (typeof event.raw_path !== 'string') return false;
    if (typeof event.method !== 'string') return false;
    if (event.version === '2.0') return false;
    if ('requestContext' in event) return false;
    // event.raw_path guards against ALBEvent, VPCLatticeV2, APIGatewayV1, APIGatewayV2
    return true;
  },

  normalize(event: VPCLatticeEventV1): NormalizedHTTPEvent {
    return {
      method: event.method,
      path: event.raw_path,
      headers: flattenHeaders(event),
      query: event.query_string_parameters ?? {},
      body: event.body ?? undefined,
      isBase64Encoded: event.is_base64_encoded,
      auth: undefined,
    };
  },

  buildResult(response: FinalizedHTTPResponse): VPCLatticeResult {
    return {
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers,
    };
  },
};
