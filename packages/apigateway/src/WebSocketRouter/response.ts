import type { WebSocketResult } from './types.js';

export function isWebSocketResponse(value: unknown): value is WebSocketResult {
  if (typeof value !== 'object' || value === null) return false;
  if (!('statusCode' in value)) return false;
  return typeof value.statusCode === 'number';
}

export function WebSocketOk(): WebSocketResult {
  return { statusCode: 200 };
}

export function WebSocketForbidden(): WebSocketResult {
  return { statusCode: 403 };
}

export function WebSocketUnauthorised(): WebSocketResult {
  return { statusCode: 401 };
}
