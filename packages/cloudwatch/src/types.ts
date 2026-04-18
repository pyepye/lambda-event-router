import type { Middleware } from '@lambda-event-router/base';
import type { CloudWatchLogsDecodedData, CloudWatchLogsEvent, Context } from 'aws-lambda';

export type CloudWatchLogsMessageType = 'DATA_MESSAGE' | 'CONTROL_MESSAGE';

export interface CloudWatchLogsRequest extends CloudWatchLogsDecodedData {
  event: CloudWatchLogsEvent;
  context: Context;
}

export interface CloudWatchLogsFilters {
  logGroup?: string | string[];
  logGroupPrefix?: string | string[];
  logGroupSuffix?: string | string[];
  logGroupIncludes?: string | string[];
  subscriptionFilter?: string | string[];
  messageType?: CloudWatchLogsMessageType | CloudWatchLogsMessageType[];
  customFilter?: (input: CloudWatchLogsDecodedData) => boolean | Promise<boolean>;
}

export type CloudWatchLogsEventFilters = Omit<CloudWatchLogsFilters, 'messageType'>;

export type CloudWatchLogsMiddleware = Middleware<CloudWatchLogsRequest, void>;

export interface CloudWatchLogsRouteDefinition {
  filters: CloudWatchLogsFilters;
  middleware?: CloudWatchLogsMiddleware[];
  handler: (request: CloudWatchLogsRequest) => Promise<void>;
}

export interface CloudWatchLogsDataMessageRouteDefinition {
  filters: CloudWatchLogsEventFilters;
  middleware?: CloudWatchLogsMiddleware[];
  handler: (request: CloudWatchLogsRequest) => Promise<void>;
}

export interface CloudWatchLogsControlMessageRouteDefinition {
  filters: CloudWatchLogsEventFilters;
  middleware?: CloudWatchLogsMiddleware[];
  handler: (request: CloudWatchLogsRequest) => Promise<void>;
}

export interface CloudWatchLogsRouterOptions {
  middleware?: CloudWatchLogsMiddleware[];
}
