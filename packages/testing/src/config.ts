import type { Context } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type ConfigMessageType =
  | 'ConfigurationItemChangeNotification'
  | 'OversizedConfigurationItemChangeNotification'
  | 'ScheduledNotification';

export interface ConfigurationItem {
  resourceType: string;
  resourceId: string;
  configurationItemStatus: string;
  configurationItemCaptureTime: string;
  configuration: Record<string, unknown>;
  tags: Record<string, string>;
  ARN: string;
  awsAccountId: string;
  configurationStateMd5Hash: string;
  resourceCreationTime: string;
  awsRegion: string;
  availabilityZone?: string;
  configurationItemVersion: string;
  supplementaryConfiguration: Record<string, unknown>;
  relatedEvents: string[];
  relationships: Array<{
    resourceType: string;
    resourceId: string;
    relationshipName: string;
  }>;
}

export interface ConfigurationItemSummary {
  resourceType: string;
  resourceId: string;
  configurationItemStatus: string;
  configurationItemCaptureTime: string;
  changeType: string;
  ARN: string;
  awsAccountId: string;
  awsRegion: string;
  configurationStateId: string;
}

export interface InvokingEvent {
  messageType: ConfigMessageType;
  configurationItem?: ConfigurationItem;
  configurationItemSummary?: ConfigurationItemSummary;
  notificationCreationTime?: string;
  recordVersion?: string;
}

export interface ConfigEvent {
  invokingEvent: string;
  ruleParameters: string;
  resultToken: string;
  eventLeftScope: boolean;
  executionRoleArn: string;
  configRuleArn: string;
  configRuleName: string;
  configRuleId: string;
  accountId: string;
  version: string;
}

export type ConfigurationItemOverrides = DeepPartial<ConfigurationItem>;

export function createConfigurationItem(overrides: ConfigurationItemOverrides = {}): ConfigurationItem {
  const defaults: ConfigurationItem = {
    resourceType: 'AWS::EC2::Instance',
    resourceId: 'i-1234567890abcdef0',
    configurationItemStatus: 'ResourceDiscovered',
    configurationItemCaptureTime: '2024-01-01T00:00:00.000Z',
    configuration: { instanceType: 't2.micro', imageId: 'ami-12345678' },
    tags: { Name: 'test-instance' },
    ARN: 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0',
    awsAccountId: '123456789012',
    configurationStateMd5Hash: 'abc123',
    resourceCreationTime: '2024-01-01T00:00:00.000Z',
    awsRegion: 'us-east-1',
    configurationItemVersion: '1.3',
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
    resourceType: 'AWS::EC2::Instance',
    resourceId: 'i-1234567890abcdef0',
    configurationItemStatus: 'ResourceDiscovered',
    configurationItemCaptureTime: '2024-01-01T00:00:00.000Z',
    changeType: 'UPDATE',
    ARN: 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0',
    awsAccountId: '123456789012',
    awsRegion: 'us-east-1',
    configurationStateId: 'state-123',
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
    notificationCreationTime: '2024-01-01T00:00:00.000Z',
    recordVersion: '1.3',
  };

  const invokingEvent = invokingEventOverride
    ? deepMerge(defaultInvokingEvent, invokingEventOverride)
    : defaultInvokingEvent;

  const ruleParameters = ruleParametersOverride ?? {};

  const defaults: ConfigEvent = {
    invokingEvent: JSON.stringify(invokingEvent),
    ruleParameters: JSON.stringify(ruleParameters),
    resultToken: 'result-token-123',
    eventLeftScope: false,
    executionRoleArn: 'arn:aws:iam::123456789012:role/config-role',
    configRuleArn: 'arn:aws:config:us-east-1:123456789012:config-rule/config-rule-abc123',
    configRuleName: 'my-config-rule',
    configRuleId: 'config-rule-abc123',
    accountId: '123456789012',
    version: '1.0',
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
