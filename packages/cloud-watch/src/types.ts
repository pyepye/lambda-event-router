import type { CloudWatchLogsDecodedData, Context } from 'aws-lambda';

export type CloudWatchLogsMessageType = 'DATA_MESSAGE' | 'CONTROL_MESSAGE';

export interface CloudWatchLogsRequest extends CloudWatchLogsDecodedData {
  context: Context;
}

export interface CloudWatchLogsFilters {
  logGroups?: string[];
  logGroupPrefixes?: string[];
  logGroupSuffixes?: string[];
  logGroupIncludes?: string[];
  subscriptionFilters?: string[];
  messageTypes?: CloudWatchLogsMessageType[];
  customFilter?: (input: CloudWatchLogsDecodedData) => boolean;
}

export type CloudWatchLogsEventFilters = Omit<CloudWatchLogsFilters, 'messageTypes'>;

export interface CloudWatchLogsRouteDefinition {
  filters: CloudWatchLogsFilters;
  handler: (request: CloudWatchLogsRequest) => Promise<void>;
}

export interface CloudWatchLogsDataMessageRouteDefinition {
  filters: CloudWatchLogsEventFilters;
  handler: (request: CloudWatchLogsRequest) => Promise<void>;
}

export interface CloudWatchLogsControlMessageRouteDefinition {
  filters: CloudWatchLogsEventFilters;
  handler: (request: CloudWatchLogsRequest) => Promise<void>;
}
