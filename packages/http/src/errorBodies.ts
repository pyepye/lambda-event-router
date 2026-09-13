import { HTTP_STATUS_CODES, statusName } from './constants.js';
import type { HTTPException } from './HTTPException.js';
import { DEFAULT_CONTENT_TYPES } from './responseType.js';
import type { FinalizedHTTPResponse, JsonBody, ResponseKind } from './types.js';

export function defaultJsonErrorBody({ message, context }: HTTPException): JsonBody {
  if (context === undefined) return { error: message };
  return { error: message, context };
}

export function defaultTextErrorBody({ message }: HTTPException): string {
  return message;
}

// The last resort when the error response itself cannot be built, so it depends on nothing a user supplies
export function fallbackServerError(kind: ResponseKind): FinalizedHTTPResponse {
  const statusCode = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
  const message = statusName(statusCode);
  if (kind === 'json') {
    return {
      statusCode,
      body: JSON.stringify({ error: message }),
      headers: { 'content-type': DEFAULT_CONTENT_TYPES.json },
      isBase64Encoded: false,
    };
  }
  return {
    statusCode,
    body: message,
    headers: { 'content-type': DEFAULT_CONTENT_TYPES.text },
    isBase64Encoded: false,
  };
}
