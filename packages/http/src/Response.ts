import { logger } from '@lambda-event-router/base';

import { HTTP_STATUS_CODES } from './constants.js';
import { HTTPException } from './HTTPException.js';
import { isJsonContentType, JSON_RESPONSE_TYPE, type ResolvedResponseType } from './responseType.js';
import type { ApiResponse, BodyForHeaders, Bytes, ErrorContext, FinalizedHTTPResponse, HTTPResponse } from './types.js';

const BYTES_CONTENT_TYPE = 'application/octet-stream';

function isBytes(value: unknown): value is Bytes {
  return value instanceof Uint8Array || value instanceof ArrayBuffer;
}

function toBuffer(value: Bytes): Buffer {
  return value instanceof ArrayBuffer ? Buffer.from(new Uint8Array(value)) : Buffer.from(value);
}

function contentTypeHeader(headers: ApiResponse['headers']): string | undefined {
  if (headers === undefined) return undefined;
  const name = Object.keys(headers).find((key) => key.toLowerCase() === 'content-type');
  return name === undefined ? undefined : headers[name];
}

// A body that JSON cannot carry is a handler fault, so it answers 500
export function bodyToJson(body: unknown): string {
  const bodyType = typeof body;
  let json: string | undefined;
  try {
    json = JSON.stringify(body);
  } catch (error) {
    logger.error('Response body cannot be sent as JSON', { bodyType, error });
    throw Response.InternalServerError();
  }

  // JSON.stringify gives no text for a function or a symbol, and writes NaN and Infinity as null
  const isNonFiniteNumber = typeof body === 'number' && !Number.isFinite(body);
  if (json === undefined || isNonFiniteNumber) {
    logger.error('Response body cannot be sent as JSON', { bodyType });
    throw Response.InternalServerError();
  }
  return json;
}

// A content-type header set on the response picks the encoding. Without one, the route's kind does
function encodeBody(
  body: unknown,
  contentType: string,
  hasHeader: boolean,
  responseType: ResolvedResponseType,
): string {
  if (isJsonContentType(contentType)) return bodyToJson(body);
  if (typeof body === 'string') return body;
  if (hasHeader || responseType.kind === 'json') return bodyToJson(body);

  logger.error('Response body is not a string', { responseType: responseType.kind, bodyType: typeof body });
  throw Response.InternalServerError();
}

export class Response {
  // Static factory methods for creating raw response objects (body not yet stringified)
  static BadRequest(message?: string, context?: ErrorContext, headers?: ApiResponse['headers']): HTTPException {
    return new HTTPException(HTTP_STATUS_CODES.BAD_REQUEST, message, context, headers);
  }

  static Unauthorized(message?: string, context?: ErrorContext, headers?: ApiResponse['headers']): HTTPException {
    return new HTTPException(HTTP_STATUS_CODES.UNAUTHORIZED, message, context, headers);
  }

  static Forbidden(message?: string, context?: ErrorContext, headers?: ApiResponse['headers']): HTTPException {
    return new HTTPException(HTTP_STATUS_CODES.FORBIDDEN, message, context, headers);
  }

  static NotFound(message?: string, context?: ErrorContext, headers?: ApiResponse['headers']): HTTPException {
    return new HTTPException(HTTP_STATUS_CODES.NOT_FOUND, message, context, headers);
  }

  static Conflict(message?: string, context?: ErrorContext, headers?: ApiResponse['headers']): HTTPException {
    return new HTTPException(HTTP_STATUS_CODES.CONFLICT, message, context, headers);
  }

  static UnprocessableContent(
    message?: string,
    context?: ErrorContext,
    headers?: ApiResponse['headers'],
  ): HTTPException {
    return new HTTPException(HTTP_STATUS_CODES.UNPROCESSABLE_CONTENT, message, context, headers);
  }

  static InternalServerError(
    message?: string,
    context?: ErrorContext,
    headers?: ApiResponse['headers'],
  ): HTTPException {
    return new HTTPException(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, message, context, headers);
  }

  static Ok<T extends BodyForHeaders<THeaders>, const THeaders extends Record<string, string> = Record<string, string>>(
    body: T,
    headers?: THeaders,
  ): HTTPResponse<T> {
    return { statusCode: HTTP_STATUS_CODES.OK, body, headers };
  }

  static Created<
    T extends BodyForHeaders<THeaders>,
    const THeaders extends Record<string, string> = Record<string, string>,
  >(body: T, headers?: THeaders): HTTPResponse<T> {
    return { statusCode: HTTP_STATUS_CODES.CREATED, body, headers };
  }

  static NoContent(): HTTPResponse<undefined> {
    return { statusCode: HTTP_STATUS_CODES.NO_CONTENT, body: undefined };
  }

  private static httpRedirect(statusCode: number, location: string): HTTPResponse<undefined> {
    return { statusCode, body: undefined, headers: { Location: location } };
  }

  static TemporaryRedirect(location: string): HTTPResponse<undefined> {
    return Response.httpRedirect(HTTP_STATUS_CODES.TEMPORARY_REDIRECT, location);
  }

  static PermanentRedirect(location: string): HTTPResponse<undefined> {
    return Response.httpRedirect(HTTP_STATUS_CODES.PERMANENT_REDIRECT, location);
  }

  private static toHTTPResponse(response: unknown): HTTPResponse {
    if (Response.isHTTPResponse(response)) return response;
    if (response == null) return Response.NoContent();
    return { statusCode: HTTP_STATUS_CODES.OK, body: response };
  }

  static isHTTPResponse(value: unknown): value is HTTPResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    if (!(Object.hasOwn(value, 'statusCode') && Object.hasOwn(value, 'body'))) {
      return false;
    }
    const response = value as { statusCode?: unknown };
    return typeof response.statusCode === 'number';
  }

  // Instance methods for building finalized responses (body stringified)
  create(response: unknown, responseType: ResolvedResponseType = JSON_RESPONSE_TYPE): FinalizedHTTPResponse {
    const { statusCode, body, headers } = Response.toHTTPResponse(response);
    if (body == null) {
      return { statusCode, body: '', headers, isBase64Encoded: false };
    }

    const headerContentType = contentTypeHeader(headers);
    const routeContentType =
      isBytes(body) && responseType.kind !== 'binary' ? BYTES_CONTENT_TYPE : responseType.contentType;
    const contentType = headerContentType ?? routeContentType;
    // Create a new object so the caller's headers are not mutated
    const finalHeaders = headerContentType === undefined ? { 'content-type': contentType, ...headers } : headers;

    // Bytes travel as base64 and every service decodes them from the same flag
    if (isBytes(body)) {
      return { statusCode, body: toBuffer(body).toString('base64'), headers: finalHeaders, isBase64Encoded: true };
    }

    const encoded = encodeBody(body, contentType, headerContentType !== undefined, responseType);
    return { statusCode, body: encoded, headers: finalHeaders, isBase64Encoded: false };
  }
}

// Re-export static methods as standalone functions
export const Ok: typeof Response.Ok = Response.Ok;
export const Created: typeof Response.Created = Response.Created;
export const NoContent: typeof Response.NoContent = Response.NoContent;
export const TemporaryRedirect: typeof Response.TemporaryRedirect = Response.TemporaryRedirect;
export const PermanentRedirect: typeof Response.PermanentRedirect = Response.PermanentRedirect;
export const BadRequest: typeof Response.BadRequest = Response.BadRequest;
export const Unauthorized: typeof Response.Unauthorized = Response.Unauthorized;
export const Forbidden: typeof Response.Forbidden = Response.Forbidden;
export const NotFound: typeof Response.NotFound = Response.NotFound;
export const Conflict: typeof Response.Conflict = Response.Conflict;
export const UnprocessableContent: typeof Response.UnprocessableContent = Response.UnprocessableContent;
export const InternalServerError: typeof Response.InternalServerError = Response.InternalServerError;
