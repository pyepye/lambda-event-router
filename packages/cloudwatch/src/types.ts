import type { CloudWatchLogsDecodedData, CloudWatchLogsEvent, Context } from 'aws-lambda';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

export type CloudWatchLogsMessageType = 'DATA_MESSAGE' | 'CONTROL_MESSAGE';

export interface CloudWatchLogsRequest extends CloudWatchLogsDecodedData {
  event: CloudWatchLogsEvent;
  context: Context;
}

export interface CloudWatchLogsFilters {
  logGroup?: FilterStringMatcher;
  subscriptionFilter?: FilterStringMatcher;
  messageType?: CloudWatchLogsMessageType | CloudWatchLogsMessageType[];
  custom?: (input: CloudWatchLogsDecodedData) => boolean | Promise<boolean>;
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
