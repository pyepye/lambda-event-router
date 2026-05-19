import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

import type { ConfigEvent } from '../types.js';

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

export interface ConfigRequest<TConfig = Record<string, unknown>, TParams = Record<string, string>> {
  configurationItem: ConfigurationItem<TConfig>;
  configurationItemSummary?: undefined;
  ruleParameters: TParams;
  resultToken: string;
  configRuleName: string;
  event: ConfigEvent;
  context: Context;
}

export interface ConfigOversizedRequest<TParams = Record<string, string>> {
  configurationItemSummary: ConfigurationItemSummary;
  configurationItem?: undefined;
  ruleParameters: TParams;
  resultToken: string;
  configRuleName: string;
  event: ConfigEvent;
  context: Context;
}

export type ConfigMiddleware = Middleware<ConfigRequest | ConfigOversizedRequest, void>;

export type ConfigChangeHandler<TConfig = Record<string, unknown>, TParams = Record<string, string>> =
  | ((request: ConfigRequest<TConfig, TParams>) => Promise<void>)
  | ((request: ConfigOversizedRequest<TParams>) => Promise<void>);

export interface ConfigChangeFilterInput {
  configRuleName: string;
  resourceType?: string;
  resourceId?: string;
  configurationItemStatus?: string;
}

export interface ConfigChangeFilters {
  configRuleName?: FilterStringMatcher;
  resourceType?: FilterStringMatcher;
  configurationItemStatus?: FilterStringMatcher;
  resourceId?: FilterStringMatcher;
  custom?: (input: ConfigChangeFilterInput) => boolean | Promise<boolean>;
}

export interface ConfigRouteDefinition<TConfig = Record<string, unknown>, TParams = Record<string, string>> {
  filters: ConfigChangeFilters;
  ruleParametersSchema?: StandardSchemaV1<unknown, TParams>;
  configurationSchema?: StandardSchemaV1<unknown, TConfig>;
  middleware?: ConfigMiddleware[];
  handler: ConfigChangeHandler<TConfig, TParams>;
}

export interface InternalConfigRoute {
  filters: ConfigChangeFilters;
  ruleParametersSchema?: StandardSchemaV1;
  configurationSchema?: StandardSchemaV1;
  middleware?: ConfigMiddleware[];
  handler: ConfigChangeHandler;
}

export interface ConfigRouteBuilder<TConfig, TParams> {
  handle(
    handler: (request: ConfigRequest<TConfig, TParams> | ConfigOversizedRequest<TParams>) => Promise<void>,
  ): ConfigRouteDefinition<TConfig, TParams>;
}

export interface ConfigRouteInput<
  TParamsSchema extends StandardSchemaV1 | undefined = undefined,
  TConfigSchema extends StandardSchemaV1 | undefined = undefined,
> {
  filters: ConfigChangeFilters;
  ruleParametersSchema?: TParamsSchema;
  configurationSchema?: TConfigSchema;
  middleware?: ConfigMiddleware[];
}

export interface ConfigRouterOptions {
  middleware?: ConfigMiddleware[];
}
