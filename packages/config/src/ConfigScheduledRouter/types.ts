import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

import type { ConfigEvent } from '../types.js';

export interface ConfigScheduledRequest<TParams = Record<string, string>> {
  resultToken: string;
  configRuleName: string;
  accountId: string;
  ruleParameters: TParams;
  event: ConfigEvent;
  context: Context;
}

export type ConfigScheduledMiddleware<TParams = Record<string, string>> = Middleware<
  ConfigScheduledRequest<TParams>,
  void
>;

export interface ConfigScheduledFilterInput {
  configRuleName: string;
  accountId: string;
}

export interface ConfigScheduledFilters {
  configRuleName?: FilterStringMatcher;
  accountId?: FilterStringMatcher;
  custom?: (input: ConfigScheduledFilterInput) => boolean | Promise<boolean>;
}

export interface ConfigScheduledRouteDefinition<TParams = Record<string, string>> {
  filters: ConfigScheduledFilters;
  ruleParametersSchema?: StandardSchemaV1<unknown, TParams>;
  middleware?: ConfigScheduledMiddleware<NoInfer<TParams>>[];
  handler: (request: ConfigScheduledRequest<TParams>) => Promise<void>;
}

export interface InternalConfigScheduledRoute {
  filters: ConfigScheduledFilters;
  ruleParametersSchema?: StandardSchemaV1;
  middleware?: ConfigScheduledMiddleware[];
  handler: (request: ConfigScheduledRequest) => Promise<void>;
}

export interface ConfigScheduledRouteBuilder<TParams> {
  handle(handler: (request: ConfigScheduledRequest<TParams>) => Promise<void>): ConfigScheduledRouteDefinition<TParams>;
}

export interface ConfigScheduledRouteInput<
  TParamsSchema extends StandardSchemaV1 | undefined = undefined,
  TParams = Record<string, string>,
> {
  filters: ConfigScheduledFilters;
  ruleParametersSchema?: TParamsSchema;
  middleware?: ConfigScheduledMiddleware<NoInfer<TParams>>[];
}

export interface ConfigScheduledRouterOptions {
  middleware?: ConfigScheduledMiddleware[];
}
