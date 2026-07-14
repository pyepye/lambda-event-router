import type { WebSocketResult } from './types.js';

export function isWebSocketResponse(value: unknown): value is WebSocketResult {
  if (typeof value !== 'object' || value === null) return false;
  if (!('statusCode' in value)) return false;
  return typeof value.statusCode === 'number';
}

// The HTTP response helpers in this package all set a body, which is how they are told apart from the
// WebSocket ones and from a status code written out by hand
export function isHTTPShapedResponse(value: unknown): boolean {
  return isWebSocketResponse(value) && Object.hasOwn(value, 'body');
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
