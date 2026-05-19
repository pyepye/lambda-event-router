import type { AppSyncIdentity, AppSyncResolverEvent, Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

// ─── Resolver Types ──────────────────────────────────────────────────────────

export interface AppSyncResolverRequest<TArgs = Record<string, unknown>> {
  arguments: TArgs;
  identity: AppSyncIdentity;
  source: Record<string, unknown> | null;
  info: {
    selectionSetList: string[];
    selectionSetGraphQL: string;
    parentTypeName: string;
    fieldName: string;
    variables: Record<string, unknown>;
  };
  headers: Record<string, string | undefined>;
  domainName: string | null;
  prev: { result: Record<string, unknown> } | null;
  stash: Record<string, unknown>;
  event: AppSyncResolverEvent<TArgs>;
  context: Context;
}

export interface AppSyncResolverFilterInput {
  parentTypeName: string;
  fieldName: string;
  event: AppSyncResolverEvent<Record<string, unknown>>;
}

export interface AppSyncResolverFilters {
  parentTypeName?: FilterStringMatcher;
  fieldName?: FilterStringMatcher;
  custom?: (input: AppSyncResolverFilterInput) => boolean | Promise<boolean>;
}

export type AppSyncResolverMiddleware<TArgs = Record<string, unknown>> = Middleware<
  AppSyncResolverRequest<TArgs>,
  unknown
>;

export interface AppSyncResolverRouteDefinition<TArgs = Record<string, unknown>> {
  filters: AppSyncResolverFilters;
  argumentsSchema?: StandardSchemaV1<unknown, TArgs>;
  middleware?: AppSyncResolverMiddleware<TArgs>[];
  handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>;
}

export type AppSyncResolverFieldFilters = Pick<AppSyncResolverFilters, 'custom'>;

export interface AppSyncResolverFieldInput<TArgs = Record<string, unknown>> {
  fieldName: string;
  filters?: AppSyncResolverFieldFilters;
  argumentsSchema?: StandardSchemaV1<unknown, TArgs>;
  middleware?: AppSyncResolverMiddleware<TArgs>[];
  handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>;
}

export type AppSyncQueryInput<TArgs = Record<string, unknown>> = AppSyncResolverFieldInput<TArgs>;
export type AppSyncMutationInput<TArgs = Record<string, unknown>> = AppSyncResolverFieldInput<TArgs>;
export type AppSyncSubscriptionInput<TArgs = Record<string, unknown>> = AppSyncResolverFieldInput<TArgs>;

// ─── Resolver Route Builder Types ────────────────────────────────────────────

export interface AppSyncResolverRouteInput<
  TArgumentsSchema extends StandardSchemaV1 | undefined = undefined,
  TArgs = TArgumentsSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TArgumentsSchema>
    : Record<string, unknown>,
> {
  filters: AppSyncResolverFilters;
  argumentsSchema?: TArgumentsSchema;
  middleware?: AppSyncResolverMiddleware<TArgs>[];
}

export interface AppSyncResolverRouteBuilder<TArgs> {
  handle(handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>): AppSyncResolverRouteDefinition<TArgs>;
}

// ─── Internal Resolver Route ─────────────────────────────────────────────────

export interface InternalResolverRoute {
  filters: AppSyncResolverFilters;
  argumentsSchema?: StandardSchemaV1;
  middleware: Middleware<AppSyncResolverRequest, unknown>[];
  handler: (request: AppSyncResolverRequest) => Promise<unknown>;
}
