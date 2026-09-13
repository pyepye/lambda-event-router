import { statusName } from './constants.js';
import type { ApiResponse, ErrorContext, ErrorStatusCode } from './types.js';

const LOWEST_ERROR_STATUS = 400;
const HIGHEST_ERROR_STATUS = 599;

function isErrorStatusCode(statusCode: number): boolean {
  return Number.isInteger(statusCode) && statusCode >= LOWEST_ERROR_STATUS && statusCode <= HIGHEST_ERROR_STATUS;
}

export class HTTPException extends Error {
  readonly statusCode: ErrorStatusCode;
  readonly context: ErrorContext | undefined;
  readonly headers: ApiResponse['headers'];

  constructor(statusCode: ErrorStatusCode, message?: string, context?: ErrorContext, headers?: ApiResponse['headers']) {
    // TypeScript already rejects this. The check is for JavaScript callers and casts
    if (!isErrorStatusCode(statusCode)) {
      throw new RangeError(`An HTTPException needs a 4xx or 5xx status code, not ${statusCode}`);
    }
    super(message ?? statusName(statusCode));
    this.name = 'HTTPException';
    this.statusCode = statusCode;
    this.context = context;
    this.headers = headers;
  }
}
