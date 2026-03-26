import type { StandardSchemaV1 } from '@standard-schema/spec';
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
  ruleParametersSchema?: StandardSchemaV1<unknown, TParams>;
  configurationSchema?: StandardSchemaV1<unknown, TConfig>;
  handler: ConfigChangeHandler<TConfig, TParams>;
}

export interface InternalConfigRoute {
  filters: ConfigChangeFilters;
  ruleParametersSchema?: StandardSchemaV1;
  configurationSchema?: StandardSchemaV1;
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
}
