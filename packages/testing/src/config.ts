import type { Context } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type ConfigMessageType =
  | 'ConfigurationItemChangeNotification'
  | 'OversizedConfigurationItemChangeNotification'
  | 'ScheduledNotification';

export interface ConfigurationItemRelationship {
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  name: string;
}

export interface ConfigurationItem {
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  configurationItemStatus: string;
  configurationItemCaptureTime: string;
  configuration: Record<string, unknown> | null;
  tags: Record<string, string>;
  ARN: string;
  awsAccountId: string;
  configurationStateId: number;
  configurationStateMd5Hash: string;
  resourceCreationTime: string | null;
  awsRegion: string;
  availabilityZone: string | null;
  configurationItemVersion: string;
  configurationItemDeliveryTime: string | null;
  recordingFrequency: string | null;
  supplementaryConfiguration: Record<string, unknown>;
  relatedEvents: string[];
  relationships: ConfigurationItemRelationship[];
}

export interface ConfigurationItemSummary {
  changeType: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  configurationItemStatus: string;
  configurationItemCaptureTime: string;
  ARN: string;
  awsAccountId: string;
  configurationStateId: number;
  configurationStateMd5Hash: string;
  resourceCreationTime: string | null;
  awsRegion: string;
  availabilityZone: string | null;
  configurationItemVersion: string;
  configurationItemDeliveryTime: string | null;
  recordingFrequency: string | null;
}

export type ConfigChangeType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface ConfigurationItemDiff {
  changeType: ConfigChangeType;
  changedProperties: Record<string, { previousValue: unknown; updatedValue: unknown; changeType: ConfigChangeType }>;
}

export interface InvokingEvent {
  messageType: ConfigMessageType;
  configurationItem?: ConfigurationItem;
  configurationItemDiff?: ConfigurationItemDiff | null;
  configurationItemSummary?: ConfigurationItemSummary;
  s3DeliverySummary?: Record<string, unknown> | null;
  notificationCreationTime: string;
  recordVersion: string;
}

export interface ConfigEvent {
  invokingEvent: string;
  ruleParameters?: string;
  resultToken: string;
  eventLeftScope: boolean;
  executionRoleArn: string;
  configRuleArn: string;
  configRuleName: string;
  configRuleId: string;
  accountId: string;
  version: string;
  evaluationMode: string;
}

export type ConfigurationItemOverrides = DeepPartial<ConfigurationItem>;

export function createConfigurationItem(overrides: ConfigurationItemOverrides = {}): ConfigurationItem {
  const defaults: ConfigurationItem = {
    resourceType: 'AWS::EC2::Instance',
    resourceId: 'i-1234567890abcdef0',
    resourceName: null,
    configurationItemStatus: 'ResourceDiscovered',
    configurationItemCaptureTime: '2024-01-01T00:00:00.000Z',
    configuration: { instanceType: 't2.micro', imageId: 'ami-12345678' },
    tags: { Name: 'test-instance' },
    ARN: 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0',
    awsAccountId: '123456789012',
    configurationStateId: 1704067200000,
    configurationStateMd5Hash: '',
    resourceCreationTime: '2024-01-01T00:00:00.000Z',
    awsRegion: 'us-east-1',
    availabilityZone: 'us-east-1a',
    configurationItemVersion: '1.3',
    configurationItemDeliveryTime: null,
    recordingFrequency: null,
    supplementaryConfiguration: {},
    relatedEvents: [],
    relationships: [],
  };

  return deepMerge(defaults, overrides);
}

export type ConfigurationItemSummaryOverrides = DeepPartial<ConfigurationItemSummary>;

export function createConfigurationItemSummary(
  overrides: ConfigurationItemSummaryOverrides = {},
): ConfigurationItemSummary {
  const defaults: ConfigurationItemSummary = {
    changeType: 'UPDATE',
    resourceType: 'AWS::EC2::Instance',
    resourceId: 'i-1234567890abcdef0',
    resourceName: null,
    configurationItemStatus: 'OK',
    configurationItemCaptureTime: '2024-01-01T00:00:00.000Z',
    ARN: 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0',
    awsAccountId: '123456789012',
    configurationStateId: 1704067200000,
    configurationStateMd5Hash: '',
    resourceCreationTime: '2024-01-01T00:00:00.000Z',
    awsRegion: 'us-east-1',
    availabilityZone: 'us-east-1a',
    configurationItemVersion: '1.3',
    configurationItemDeliveryTime: null,
    recordingFrequency: null,
  };

  return deepMerge(defaults, overrides);
}

export type ConfigEventOverrides = Omit<DeepPartial<ConfigEvent>, 'invokingEvent' | 'ruleParameters'> & {
  invokingEvent?: DeepPartial<InvokingEvent>;
  ruleParameters?: Record<string, string>;
};

export function createConfigEvent(overrides: ConfigEventOverrides = {}): ConfigEvent {
  const { invokingEvent: invokingEventOverride, ruleParameters: ruleParametersOverride, ...restOverrides } = overrides;

  const defaultInvokingEvent: InvokingEvent = {
    messageType: 'ConfigurationItemChangeNotification',
    configurationItem: createConfigurationItem(),
    configurationItemDiff: null,
    notificationCreationTime: '2024-01-01T00:00:00.000Z',
    recordVersion: '1.3',
  };

  const invokingEvent = invokingEventOverride
    ? deepMerge(defaultInvokingEvent, invokingEventOverride)
    : defaultInvokingEvent;

  // Config leaves ruleParameters out when the rule has none
  const defaults: ConfigEvent = {
    invokingEvent: JSON.stringify(invokingEvent),
    ...(ruleParametersOverride ? { ruleParameters: JSON.stringify(ruleParametersOverride) } : {}),
    resultToken: 'result-token-123',
    eventLeftScope: false,
    executionRoleArn: 'arn:aws:iam::123456789012:role/config-role',
    configRuleArn: 'arn:aws:config:us-east-1:123456789012:config-rule/config-rule-abc123',
    configRuleName: 'my-config-rule',
    configRuleId: 'config-rule-abc123',
    accountId: '123456789012',
    version: '1.0',
    evaluationMode: 'DETECTIVE',
  };

  return deepMerge(defaults, restOverrides);
}

export interface ConfigHandlerEvent {
  event: ConfigEvent;
  context: Context;
}

export interface CreateConfigHandlerEventOptions {
  event?: ConfigEventOverrides;
  context?: Partial<Context>;
}

export function createConfigHandlerEvent(options: CreateConfigHandlerEventOptions = {}): ConfigHandlerEvent {
  const event = createConfigEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface ConfigFixtures {
  configEvent: (overrides?: ConfigEventOverrides) => ConfigEvent;
  configHandlerEvent: (options?: CreateConfigHandlerEventOptions) => ConfigHandlerEvent;
  configurationItem: (overrides?: ConfigurationItemOverrides) => ConfigurationItem;
  configurationItemSummary: (overrides?: ConfigurationItemSummaryOverrides) => ConfigurationItemSummary;
}

export const configFixtures: FixtureMap<ConfigFixtures> = {
  configEvent: fixture(createConfigEvent),
  configHandlerEvent: fixture(createConfigHandlerEvent),
  configurationItem: fixture(createConfigurationItem),
  configurationItemSummary: fixture(createConfigurationItemSummary),
};
