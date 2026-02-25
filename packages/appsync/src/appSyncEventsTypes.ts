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
