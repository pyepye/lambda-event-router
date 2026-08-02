import { isObject } from '@lambda-event-router/base';
import {
  type Auth,
  buildValueMaps,
  type FinalizedHTTPResponse,
  type HTTPAdapter,
  type HttpMethod,
  type NormalizedHTTPEvent,
} from '@lambda-event-router/http';

import { fieldsFromLatticeHeader, IDENTITY_HEADER, NETWORK_HEADER, pathWithoutQuery } from './latticeEvent.js';

export interface VPCLatticeEventBase {
  method: HttpMethod;
  body?: string;
}

export interface VPCLatticeEventV1 extends VPCLatticeEventBase {
  raw_path: string;
  headers?: Record<string, string>;
  query_string_parameters?: Record<string, string>;
  is_base64_encoded: boolean;
  request_id?: string;
}

export interface VPCLatticeResult {
  statusCode: number;
  body?: string;
  isBase64Encoded?: boolean;
  headers?: Record<string, string>;
}

function extractV1Auth(headers: Record<string, string | undefined>): Auth | undefined {
  const identity = {
    ...fieldsFromLatticeHeader(headers[NETWORK_HEADER]),
    ...fieldsFromLatticeHeader(headers[IDENTITY_HEADER]),
  };
  if (!identity.principal) return undefined;
  return { principalId: identity.principal, iam: identity };
}

export const vpcLatticeV1Adapter: HTTPAdapter<VPCLatticeEventV1, VPCLatticeResult> = {
  canHandleEvent(event: unknown): event is VPCLatticeEventV1 {
    if (!isObject(event)) return false;
    if (typeof event.raw_path !== 'string') return false;
    if (typeof event.method !== 'string') return false;
    if (event.version === '2.0') return false;
    if ('requestContext' in event) return false;
    // event.raw_path guards against ALBEvent, VPCLatticeV2, APIGatewayV1, APIGatewayV2
    return true;
  },

  normalize(event: VPCLatticeEventV1): NormalizedHTTPEvent {
    // VPC Lattice 1.0 carries only single-value headers and query params; each becomes a
    // one-element entry in the multi-value maps.
    const headers = buildValueMaps({ single: event.headers, lowercaseKeys: true });
    const query = buildValueMaps({ single: event.query_string_parameters });

    return {
      method: event.method,
      path: pathWithoutQuery(event.raw_path),
      headers: headers.flat,
      multiValueHeaders: headers.multiValue,
      query: query.flat,
      multiValueQuery: query.multiValue,
      body: event.body ?? undefined,
      isBase64Encoded: event.is_base64_encoded,
      auth: extractV1Auth(headers.flat),
    };
  },

  buildResult(response: FinalizedHTTPResponse): VPCLatticeResult {
    return {
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers,
      isBase64Encoded: response.isBase64Encoded,
    };
  },
};
