import type { Schema } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type { ConfigEvent } from './types.js';

export interface ConfigScheduledRequest<TParams = Record<string, string>> {
  resultToken: string;
  configRuleName: string;
  accountId: string;
  ruleParameters: TParams;
  event: ConfigEvent;
  context: Context;
}

export interface ConfigScheduledFilters {
  configRuleNames?: string[];
  accountIds?: string[];
}

export interface ConfigScheduledRouteDefinition<TParams = Record<string, string>> {
  filters: ConfigScheduledFilters;
  ruleParametersSchema?: Schema<TParams>;
  handler: (request: ConfigScheduledRequest<TParams>) => Promise<void>;
}

export interface InternalConfigScheduledRoute {
  filters: ConfigScheduledFilters;
  ruleParametersSchema?: Schema<unknown>;
  handler: (request: ConfigScheduledRequest) => Promise<void>;
}

export interface ConfigScheduledRouteBuilder<TParams> {
  handle(handler: (request: ConfigScheduledRequest<TParams>) => Promise<void>): ConfigScheduledRouteDefinition<TParams>;
}

export interface ConfigScheduledRouteInput<TParamsSchema extends Schema<unknown> | undefined = undefined> {
  filters: ConfigScheduledFilters;
  ruleParametersSchema?: TParamsSchema;
}
