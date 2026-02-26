import type { Schema } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type { ConfigEvent, ConfigurationItem, ConfigurationItemSummary } from './types.js';

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

export type ConfigChangeHandler<TConfig = Record<string, unknown>, TParams = Record<string, string>> =
  | ((request: ConfigRequest<TConfig, TParams>) => Promise<void>)
  | ((request: ConfigOversizedRequest<TParams>) => Promise<void>);

export interface ConfigChangeFilters {
  configRuleNames?: string[];
  resourceTypes?: string[];
  configurationItemStatuses?: string[];
  resourceIds?: string[];
}

export interface ConfigRouteDefinition<TConfig = Record<string, unknown>, TParams = Record<string, string>> {
  filters: ConfigChangeFilters;
  ruleParametersSchema?: Schema<TParams>;
  configurationSchema?: Schema<TConfig>;
  handler: ConfigChangeHandler<TConfig, TParams>;
}

export interface InternalConfigRoute {
  filters: ConfigChangeFilters;
  ruleParametersSchema?: Schema<unknown>;
  configurationSchema?: Schema<unknown>;
  handler: ConfigChangeHandler;
}

export interface ConfigRouteBuilder<TConfig, TParams> {
  handle(
    handler: (request: ConfigRequest<TConfig, TParams> | ConfigOversizedRequest<TParams>) => Promise<void>,
  ): ConfigRouteDefinition<TConfig, TParams>;
}

export interface ConfigRouteInput<
  TParamsSchema extends Schema<unknown> | undefined = undefined,
  TConfigSchema extends Schema<unknown> | undefined = undefined,
> {
  filters: ConfigChangeFilters;
  ruleParametersSchema?: TParamsSchema;
  configurationSchema?: TConfigSchema;
}
