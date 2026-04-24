import type { Context } from 'aws-lambda';

import type { FilterStringMatcher } from '@lambda-event-router/base';

export type AppSyncEventsOperation = 'PUBLISH' | 'SUBSCRIBE';

export interface AppSyncEventsIdentity {
  sub?: string;
  issuer?: string;
  username?: string;
  claims?: Record<string, unknown>;
  sourceIp?: string[];
  groups?: string[] | null;
  [key: string]: unknown;
}

export interface AppSyncEventsEvent {
  identity: AppSyncEventsIdentity | null | undefined;
  request: {
    headers: Record<string, string | undefined>;
    domainName: string | null;
  };
  info: {
    channel: {
      path: string;
      segments: string[];
    };
    channelNamespace: {
      name: string;
    };
    operation: AppSyncEventsOperation;
  };
  stash: Record<string, unknown>;
  events: Record<string, unknown>[] | null;
  prev: { result: Record<string, unknown> } | null;
  result: unknown;
  error: unknown;
  outErrors: unknown[];
}

export interface AppSyncEventsRequest {
  channel: string;
  channelNamespace: string;
  operation: AppSyncEventsOperation;
  identity: AppSyncEventsIdentity | null | undefined;
  events: Record<string, unknown>[];
  info: AppSyncEventsEvent['info'];
  request: AppSyncEventsEvent['request'];
  stash: Record<string, unknown>;
  prev: AppSyncEventsEvent['prev'];
  event: AppSyncEventsEvent;
  context: Context;
}

export interface AppSyncEventsFilterInput {
  operation: AppSyncEventsOperation;
  channelNamespace: string;
  channel: string;
  event: AppSyncEventsEvent;
}

export interface AppSyncEventsFilters {
  operation?: AppSyncEventsOperation | AppSyncEventsOperation[];
  channelNamespace?: FilterStringMatcher;
  customFilter?: (input: AppSyncEventsFilterInput) => boolean | Promise<boolean>;
}

export interface AppSyncEventsRouteDefinition {
  filters: AppSyncEventsFilters;
  handler: (request: AppSyncEventsRequest) => Promise<unknown>;
}

export type AppSyncEventsOperationFilters = Pick<AppSyncEventsFilters, 'customFilter'>;

export interface AppSyncEventsChannelInput {
  channelNamespace: string;
  filters?: AppSyncEventsOperationFilters;
  handler: (request: AppSyncEventsRequest) => Promise<unknown>;
}

export type AppSyncPublishInput = AppSyncEventsChannelInput;
export type AppSyncSubscribeInput = AppSyncEventsChannelInput;

export interface AppSyncEventsRouteInput {
  filters?: AppSyncEventsFilters;
}

export interface AppSyncEventsRouteBuilder {
  handle(handler: (request: AppSyncEventsRequest) => Promise<unknown>): AppSyncEventsRouteDefinition;
}

export interface InternalEventsRoute {
  filters: AppSyncEventsFilters;
  handler: (request: AppSyncEventsRequest) => Promise<unknown>;
}
