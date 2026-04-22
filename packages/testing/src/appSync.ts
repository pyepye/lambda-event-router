import type { AppSyncAuthorizerEvent, AppSyncResolverEvent, Context } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

// ─── AppSync Events types (local to avoid circular deps) ─────────────────────

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

// ─── Resolver Event ──────────────────────────────────────────────────────────

export type AppSyncResolverEventOverrides = DeepPartial<AppSyncResolverEvent<Record<string, unknown>>>;

export interface AppSyncResolverHandlerEvent {
  event: AppSyncResolverEvent<Record<string, unknown>>;
  context: Context;
}

export interface CreateAppSyncResolverHandlerEventOptions {
  event?: AppSyncResolverEventOverrides;
  context?: Partial<Context>;
}

export function createAppSyncResolverEvent(
  overrides: AppSyncResolverEventOverrides = {},
): AppSyncResolverEvent<Record<string, unknown>> {
  const defaults: AppSyncResolverEvent<Record<string, unknown>> = {
    arguments: {},
    identity: undefined,
    source: null,
    stash: {},
    prev: null,
    info: {
      selectionSetList: [],
      selectionSetGraphQL: '',
      parentTypeName: 'Query',
      fieldName: 'getUser',
      variables: {},
    },
    request: {
      headers: {},
      domainName: null,
    },
  };

  return deepMerge(defaults, overrides);
}

export function createAppSyncResolverHandlerEvent(
  options: CreateAppSyncResolverHandlerEventOptions = {},
): AppSyncResolverHandlerEvent {
  const event = createAppSyncResolverEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

// ─── Authorizer Event ────────────────────────────────────────────────────────

export interface AppSyncAuthorizerHandlerEvent {
  event: AppSyncAuthorizerEvent;
  context: Context;
}

export interface CreateAppSyncAuthorizerHandlerEventOptions {
  event?: DeepPartial<AppSyncAuthorizerEvent>;
  context?: Partial<Context>;
}

export function createAppSyncAuthorizerEvent(
  overrides: DeepPartial<AppSyncAuthorizerEvent> = {},
): AppSyncAuthorizerEvent {
  const defaults: AppSyncAuthorizerEvent = {
    authorizationToken: 'Bearer test-token',
    requestHeaders: {},
    requestContext: {
      apiId: 'test-api-id',
      accountId: '123456789012',
      requestId: crypto.randomUUID(),
      queryString: 'query { getUser { id name } }',
      operationName: 'GetUser',
      variables: {},
    },
  };

  return deepMerge(defaults, overrides);
}

export function createAppSyncAuthorizerHandlerEvent(
  options: CreateAppSyncAuthorizerHandlerEventOptions = {},
): AppSyncAuthorizerHandlerEvent {
  const event = createAppSyncAuthorizerEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

// ─── Events Event ────────────────────────────────────────────────────────────

export type AppSyncEventsEventOverrides = DeepPartial<AppSyncEventsEvent>;

export interface AppSyncEventsHandlerEvent {
  event: AppSyncEventsEvent;
  context: Context;
}

export interface CreateAppSyncEventsHandlerEventOptions {
  event?: AppSyncEventsEventOverrides;
  context?: Partial<Context>;
}

export function createAppSyncEventsEvent(overrides: AppSyncEventsEventOverrides = {}): AppSyncEventsEvent {
  const defaults: AppSyncEventsEvent = {
    identity: null,
    stash: {},
    events: [{ data: 'test-payload' }],
    prev: null,
    result: null,
    error: null,
    outErrors: [],
    info: {
      channel: {
        path: '/default/channel',
        segments: ['default', 'channel'],
      },
      channelNamespace: {
        name: 'default',
      },
      operation: 'PUBLISH',
    },
    request: {
      headers: {},
      domainName: null,
    },
  };

  return deepMerge(defaults, overrides);
}

export function createAppSyncEventsHandlerEvent(
  options: CreateAppSyncEventsHandlerEventOptions = {},
): AppSyncEventsHandlerEvent {
  const event = createAppSyncEventsEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface AppSyncFixtures {
  appSyncResolverEvent: (overrides?: AppSyncResolverEventOverrides) => AppSyncResolverEvent<Record<string, unknown>>;
  appSyncResolverHandlerEvent: (options?: CreateAppSyncResolverHandlerEventOptions) => AppSyncResolverHandlerEvent;
  appSyncAuthorizerEvent: (overrides?: DeepPartial<AppSyncAuthorizerEvent>) => AppSyncAuthorizerEvent;
  appSyncAuthorizerHandlerEvent: (
    options?: CreateAppSyncAuthorizerHandlerEventOptions,
  ) => AppSyncAuthorizerHandlerEvent;
  appSyncEventsEvent: (overrides?: AppSyncEventsEventOverrides) => AppSyncEventsEvent;
  appSyncEventsHandlerEvent: (options?: CreateAppSyncEventsHandlerEventOptions) => AppSyncEventsHandlerEvent;
}

export const appSyncFixtures: FixtureMap<AppSyncFixtures> = {
  appSyncResolverEvent: fixture(createAppSyncResolverEvent),
  appSyncResolverHandlerEvent: fixture(createAppSyncResolverHandlerEvent),
  appSyncAuthorizerEvent: fixture(createAppSyncAuthorizerEvent),
  appSyncAuthorizerHandlerEvent: fixture(createAppSyncAuthorizerHandlerEvent),
  appSyncEventsEvent: fixture(createAppSyncEventsEvent),
  appSyncEventsHandlerEvent: fixture(createAppSyncEventsHandlerEvent),
};
