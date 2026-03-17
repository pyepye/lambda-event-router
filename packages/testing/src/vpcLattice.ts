import type { Context } from 'aws-lambda';
import { createMockContext } from './context.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

interface VPCLatticeEventV1 {
  method: HttpMethod;
  raw_path: string;
  body?: string;
  headers?: Record<string, string>;
  query_string_parameters?: Record<string, string>;
  is_base64_encoded: boolean;
}

interface VPCLatticeRequestContextV2 {
  serviceArn: string;
  serviceNetworkArn: string;
  targetGroupArn: string;
  region: string;
  timeEpoch: number | string;
  identity?: {
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
  };
}

interface VPCLatticeEventV2 {
  version: '2.0';
  method: HttpMethod;
  path: string;
  body?: string;
  headers?: Record<string, string[]>;
  queryStringParameters?: Record<string, string[]>;
  isBase64Encoded: boolean;
  requestContext: VPCLatticeRequestContextV2;
}

export type VPCLatticeV1EventOverrides = Omit<Partial<VPCLatticeEventV1>, 'body'> & {
  body?: string | Record<string, unknown> | null;
};

export function createVPCLatticeV1Event(overrides: VPCLatticeV1EventOverrides = {}): VPCLatticeEventV1 {
  const { body: bodyOverride, ...restOverrides } = overrides;

  const isObjectBody = bodyOverride !== null && typeof bodyOverride === 'object';
  const resolvedBody = isObjectBody ? JSON.stringify(bodyOverride) : (bodyOverride ?? undefined);

  return {
    method: 'GET',
    raw_path: '/',
    is_base64_encoded: false,
    headers: {},
    ...restOverrides,
    ...(resolvedBody !== undefined ? { body: resolvedBody } : {}),
  };
}

export interface VPCLatticeV1HandlerEvent {
  event: VPCLatticeEventV1;
  context: Context;
}

export interface CreateVPCLatticeV1HandlerEventOptions {
  event?: VPCLatticeV1EventOverrides;
  context?: Partial<Context>;
}

export function createVPCLatticeV1HandlerEvent(
  options: CreateVPCLatticeV1HandlerEventOptions = {},
): VPCLatticeV1HandlerEvent {
  const event = createVPCLatticeV1Event(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export type VPCLatticeV2EventOverrides = Omit<Partial<VPCLatticeEventV2>, 'requestContext' | 'body'> & {
  requestContext?: Omit<Partial<VPCLatticeRequestContextV2>, 'identity'> & {
    identity?: Partial<NonNullable<VPCLatticeRequestContextV2['identity']>>;
  };
  body?: string | Record<string, unknown> | null;
};

export function createVPCLatticeV2Event(overrides: VPCLatticeV2EventOverrides = {}): VPCLatticeEventV2 {
  const { requestContext: requestContextOverrides, body: bodyOverride, ...restOverrides } = overrides;
  const { identity: identityOverrides, ...restRequestContextOverrides } = requestContextOverrides ?? {};

  const isObjectBody = bodyOverride !== null && typeof bodyOverride === 'object';
  const resolvedBody = isObjectBody ? JSON.stringify(bodyOverride) : (bodyOverride ?? undefined);

  return {
    version: '2.0',
    method: 'GET',
    path: '/',
    isBase64Encoded: false,
    requestContext: {
      serviceArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:service/svc-1234567890abcdef0',
      serviceNetworkArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:servicenetwork/sn-1234567890abcdef0',
      targetGroupArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:targetgroup/tg-1234567890abcdef0',
      region: 'us-east-1',
      timeEpoch: 1704067200000,
      ...(identityOverrides ? { identity: identityOverrides } : {}),
      ...restRequestContextOverrides,
    },
    ...restOverrides,
    ...(resolvedBody !== undefined ? { body: resolvedBody } : {}),
  };
}

export interface VPCLatticeV2HandlerEvent {
  event: VPCLatticeEventV2;
  context: Context;
}

export interface CreateVPCLatticeV2HandlerEventOptions {
  event?: VPCLatticeV2EventOverrides;
  context?: Partial<Context>;
}

export function createVPCLatticeV2HandlerEvent(
  options: CreateVPCLatticeV2HandlerEventOptions = {},
): VPCLatticeV2HandlerEvent {
  const event = createVPCLatticeV2Event(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface VPCLatticeFixtures {
  vpcLatticeV1Event: (overrides?: VPCLatticeV1EventOverrides) => ReturnType<typeof createVPCLatticeV1Event>;
  vpcLatticeV1HandlerEvent: (options?: CreateVPCLatticeV1HandlerEventOptions) => VPCLatticeV1HandlerEvent;
  vpcLatticeV2Event: (overrides?: VPCLatticeV2EventOverrides) => ReturnType<typeof createVPCLatticeV2Event>;
  vpcLatticeV2HandlerEvent: (options?: CreateVPCLatticeV2HandlerEventOptions) => VPCLatticeV2HandlerEvent;
}

export const vpcLatticeFixtures: FixtureMap<VPCLatticeFixtures> = {
  vpcLatticeV1Event: fixture(createVPCLatticeV1Event),
  vpcLatticeV1HandlerEvent: fixture(createVPCLatticeV1HandlerEvent),
  vpcLatticeV2Event: fixture(createVPCLatticeV2Event),
  vpcLatticeV2HandlerEvent: fixture(createVPCLatticeV2HandlerEvent),
};
