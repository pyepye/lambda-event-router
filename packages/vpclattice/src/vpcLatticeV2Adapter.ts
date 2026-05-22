import { isObject } from '@lambda-event-router/base';
import {
  type Auth,
  buildValueMaps,
  type FinalizedHTTPResponse,
  type HTTPAdapter,
  type NormalizedHTTPEvent,
} from '@lambda-event-router/http';

import type { VPCLatticeEventBase, VPCLatticeResult } from './vpcLatticeV1Adapter';

// TODO: This needs confirming
export interface VPCLatticeIdentity {
  sourceVpcArn?: string;
  type?: string;
  principal?: string;
  principalOrgID?: string;
  sessionName?: string;
  x509IssuerOu?: string;
  x509SanDns?: string;
  x509SanNameCn?: string;
  x509SanUri?: string;
  x509SubjectCn?: string;
}

// TODO: This needs confirming
export interface VPCLatticeRequestContextV2 {
  serviceArn: string;
  serviceNetworkArn: string;
  targetGroupArn: string;
  region: string;
  timeEpoch: number | string;
  identity?: VPCLatticeIdentity;
}

// TODO: This needs confirming - Can we use AWS Powertools types here?
export interface VPCLatticeEventV2 extends VPCLatticeEventBase {
  version: '2.0';
  path: string;
  headers?: Record<string, string[]>;
  queryStringParameters?: Record<string, string[]>;
  isBase64Encoded: boolean;
  requestContext: VPCLatticeRequestContextV2;
}

function extractV2Auth(event: VPCLatticeEventV2): Auth | undefined {
  const { requestContext } = event;
  // TODO: Deal with auth - what should be included? This is currently a guess and has not been thought about
  if (requestContext.identity?.principal) {
    return { principalId: requestContext.identity?.principal };
  }
  return undefined;
}

export const vpcLatticeV2Adapter: HTTPAdapter<VPCLatticeEventV2, VPCLatticeResult> = {
  canHandleEvent(event: unknown): event is VPCLatticeEventV2 {
    // TODO: This needs confirming
    if (!isObject(event)) return false;
    if (typeof event.path !== 'string') return false;
    if (typeof event.method !== 'string') return false;
    if (event.version !== '2.0') return false;
    if (!isObject(event.requestContext)) return false;
    if (typeof event.requestContext.serviceArn !== 'string') return false; // Guard against APIGateway V1
    if (isObject(event.requestContext.elb)) return false; // Guard against ALBEvent
    // event.path guard against VPCLatticeV1, APIGatewayV2
    // event.method guards against ALBEvent, APIGatewayV2
    return true;
  },

  normalize(event: VPCLatticeEventV2): NormalizedHTTPEvent {
    // VPC Lattice 2.0 always sends the multi-value form. Collapse to the last value for the flat
    // maps, matching the other adapters, and keep every value in the multi-value maps.
    const headers = buildValueMaps({ multi: event.headers, lowercaseKeys: true });
    const query = buildValueMaps({ multi: event.queryStringParameters });

    return {
      method: event.method,
      path: event.path,
      headers: headers.flat,
      multiValueHeaders: headers.multiValue,
      query: query.flat,
      multiValueQuery: query.multiValue,
      body: event.body,
      isBase64Encoded: event.isBase64Encoded,
      auth: extractV2Auth(event),
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
