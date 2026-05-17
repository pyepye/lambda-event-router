import type { AppSyncAuthorizerResponse } from './types.js';

export function isAppSyncAuthorizerResponse(value: unknown): value is AppSyncAuthorizerResponse {
  if (typeof value !== 'object' || value === null) return false;
  if (!('isAuthorized' in value)) return false;
  return typeof value.isAuthorized === 'boolean';
}

export interface AuthorizedOptions {
  resolverContext?: Record<string, unknown>;
  deniedFields?: string[];
  ttlOverride?: number;
}

export function Authorized(options?: AuthorizedOptions): AppSyncAuthorizerResponse {
  const result: AppSyncAuthorizerResponse = { isAuthorized: true };

  if (options?.resolverContext) {
    result.resolverContext = options.resolverContext;
  }

  if (options?.deniedFields) {
    result.deniedFields = options.deniedFields;
  }

  if (options?.ttlOverride !== undefined) {
    result.ttlOverride = options.ttlOverride;
  }

  return result;
}

export interface DeniedOptions {
  ttlOverride?: number;
}

export function Denied(options?: DeniedOptions): AppSyncAuthorizerResponse {
  const result: AppSyncAuthorizerResponse = { isAuthorized: false };

  if (options?.ttlOverride !== undefined) {
    result.ttlOverride = options.ttlOverride;
  }

  return result;
}
