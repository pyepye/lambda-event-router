import type { AppSyncAuthorizerResult } from 'aws-lambda';

type AuthorizerResult = AppSyncAuthorizerResult<Record<string, unknown>>;

export function isAppSyncAuthorizerResponse(value: unknown): value is AuthorizerResult {
  if (typeof value !== 'object' || value === null) return false;
  if (!('isAuthorized' in value)) return false;
  return typeof value.isAuthorized === 'boolean';
}

interface AuthorizedOptions {
  resolverContext?: Record<string, unknown>;
  ttlOverride?: number;
}

export function Authorized(options?: AuthorizedOptions): AuthorizerResult {
  const result: AuthorizerResult = { isAuthorized: true };

  if (options?.resolverContext) {
    result.resolverContext = options.resolverContext;
  }

  if (options?.ttlOverride !== undefined) {
    result.ttlOverride = options.ttlOverride;
  }

  return result;
}

interface DeniedOptions {
  deniedFields?: string[];
  ttlOverride?: number;
}

export function Denied(options?: DeniedOptions): AuthorizerResult {
  const result: AuthorizerResult = { isAuthorized: false };

  if (options?.deniedFields) {
    result.deniedFields = options.deniedFields;
  }

  if (options?.ttlOverride !== undefined) {
    result.ttlOverride = options.ttlOverride;
  }

  return result;
}
