import type { WebSocketResult } from './webSocketTypes.js';

export function WebSocketOk(): WebSocketResult {
  return { statusCode: 200 };
}

export function WebSocketForbidden(): WebSocketResult {
  return { statusCode: 403 };
}

export function WebSocketUnauthorised(): WebSocketResult {
  return { statusCode: 401 };
}
