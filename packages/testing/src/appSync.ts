import type { AppSyncAuthorizerEvent, AppSyncIdentity, AppSyncResolverEvent, Context } from 'aws-lambda';
import { createMockContext } from './context.js';
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

export interface AppSyncResolverEventOverrides {
  arguments?: Record<string, unknown>;
  identity?: AppSyncIdentity;
  source?: Record<string, unknown> | null;
  stash?: Record<string, unknown>;
  prev?: { result: Record<string, unknown> } | null;
  info?: Partial<AppSyncResolverEvent<Record<string, unknown>>['info']>;
  request?: Partial<AppSyncResolverEvent<Record<string, unknown>>['request']>;
}

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
  return {
    arguments: overrides.arguments ?? {},
    identity: overrides.identity ?? undefined,
    source: overrides.source ?? null,
    stash: overrides.stash ?? {},
    prev: overrides.prev ?? null,
    info: {
      selectionSetList: [],
      selectionSetGraphQL: '',
      parentTypeName: 'Query',
      fieldName: 'getUser',
      variables: {},
      ...overrides.info,
    },
    request: {
      headers: {},
      domainName: null,
      ...overrides.request,
    },
  };
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
  return {
    authorizationToken: overrides.authorizationToken ?? 'Bearer test-token',
    requestHeaders: overrides.requestHeaders ?? {},
    requestContext: {
      apiId: 'test-api-id',
      accountId: '123456789012',
      requestId: crypto.randomUUID(),
      queryString: 'query { getUser { id name } }',
      operationName: 'GetUser',
      variables: {},
      ...overrides.requestContext,
    },
  };
}

export function createAppSyncAuthorizerHandlerEvent(
  options: CreateAppSyncAuthorizerHandlerEventOptions = {},
): AppSyncAuthorizerHandlerEvent {
  const event = createAppSyncAuthorizerEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

// ─── Events Event ────────────────────────────────────────────────────────────

export interface AppSyncEventsEventOverrides {
  identity?: AppSyncEventsIdentity | null;
  stash?: Record<string, unknown>;
  events?: Record<string, unknown>[] | null;
  prev?: { result: Record<string, unknown> } | null;
  result?: unknown;
  error?: unknown;
  outErrors?: unknown[];
  info?: {
    channel?: Partial<AppSyncEventsEvent['info']['channel']>;
    channelNamespace?: Partial<AppSyncEventsEvent['info']['channelNamespace']>;
    operation?: AppSyncEventsOperation;
  };
  request?: Partial<AppSyncEventsEvent['request']>;
}

export interface AppSyncEventsHandlerEvent {
  event: AppSyncEventsEvent;
  context: Context;
}

export interface CreateAppSyncEventsHandlerEventOptions {
  event?: AppSyncEventsEventOverrides;
  context?: Partial<Context>;
}

export function createAppSyncEventsEvent(overrides: AppSyncEventsEventOverrides = {}): AppSyncEventsEvent {
  const infoOverrides = overrides.info;

  return {
    identity: overrides.identity ?? null,
    stash: overrides.stash ?? {},
    events: Object.hasOwn(overrides, 'events') ? (overrides.events ?? null) : [{ data: 'test-payload' }],
    prev: overrides.prev ?? null,
    result: overrides.result ?? null,
    error: overrides.error ?? null,
    outErrors: overrides.outErrors ?? [],
    info: {
      channel: {
        path: '/default/channel',
        segments: ['default', 'channel'],
        ...infoOverrides?.channel,
      },
      channelNamespace: {
        name: 'default',
        ...infoOverrides?.channelNamespace,
      },
      operation: infoOverrides?.operation ?? 'PUBLISH',
    },
    request: {
      headers: {},
      domainName: null,
      ...overrides.request,
    },
  };
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
