import type { AppSyncEventsAuthorizerResponse } from './types.js';

export function isAppSyncEventsAuthorizerResponse(value: unknown): value is AppSyncEventsAuthorizerResponse {
  if (typeof value !== 'object' || value === null) return false;
  if (!('isAuthorized' in value)) return false;
  return typeof value.isAuthorized === 'boolean';
}

export interface EventsAuthorizedOptions {
  handlerContext?: Record<string, unknown>;
  ttlOverride?: number;
}

export function EventsAuthorized(options?: EventsAuthorizedOptions): AppSyncEventsAuthorizerResponse {
  const result: AppSyncEventsAuthorizerResponse = { isAuthorized: true };

  if (options?.handlerContext) {
    result.handlerContext = options.handlerContext;
  }

  if (options?.ttlOverride !== undefined) {
    result.ttlOverride = options.ttlOverride;
  }

  return result;
}

export interface EventsDeniedOptions {
  ttlOverride?: number;
}

export function EventsDenied(options?: EventsDeniedOptions): AppSyncEventsAuthorizerResponse {
  const result: AppSyncEventsAuthorizerResponse = { isAuthorized: false };

  if (options?.ttlOverride !== undefined) {
    result.ttlOverride = options.ttlOverride;
  }

  return result;
}
