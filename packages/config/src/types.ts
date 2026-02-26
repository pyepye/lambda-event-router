import type { Context } from 'aws-lambda';

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

export type ConfigMessageType =
  | 'ConfigurationItemChangeNotification'
  | 'OversizedConfigurationItemChangeNotification'
  | 'ScheduledNotification';

export interface ConfigurationItem<TConfig = Record<string, unknown>> {
  resourceType: string;
  resourceId: string;
  configurationItemStatus: string;
  configurationItemCaptureTime: string;
  configuration: TConfig;
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

export type ConfigResponse = undefined;

export interface InvokingEvent {
  messageType: ConfigMessageType;
  configurationItem?: ConfigurationItem;
  configurationItemSummary?: ConfigurationItemSummary;
  notificationCreationTime?: string;
  recordVersion?: string;
}

export interface ConfigHandlerContext {
  event: ConfigEvent;
  context: Context;
}
