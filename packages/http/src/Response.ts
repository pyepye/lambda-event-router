import { logger } from '@lambda-event-router/base';

import { HTTP_STATUS_CODES } from './constants.js';
import type { ApiResponse, FinalizedHTTPResponse, HTTPResponse } from './types.js';

const CONTENT_TYPE_JSON = 'application/json';
const CONTENT_TYPE_TEXT = 'text/plain; charset=utf-8';
const CONTENT_TYPE_HTML = 'text/html; charset=utf-8';

export class Response {
  // Static factory methods for creating raw response objects (body not yet stringified)
  static BadRequest(): HTTPResponse<{ error: string }>;
  static BadRequest<T>(body: T, headers?: ApiResponse['headers']): HTTPResponse<T>;
  static BadRequest<T>(body?: T, headers?: ApiResponse['headers']): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.BAD_REQUEST, body: body ?? { error: 'Bad request' }, headers };
  }

  static Unauthorised(): HTTPResponse<{ error: string }>;
  static Unauthorised<T>(body: T, headers?: ApiResponse['headers']): HTTPResponse<T>;
  static Unauthorised<T>(body?: T, headers?: ApiResponse['headers']): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.UNAUTHORIZED, body: body ?? { error: 'Unauthorised' }, headers };
  }

  static Forbidden(): HTTPResponse<{ error: string }>;
  static Forbidden<T>(body: T, headers?: ApiResponse['headers']): HTTPResponse<T>;
  static Forbidden<T>(body?: T, headers?: ApiResponse['headers']): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.FORBIDDEN, body: body ?? { error: 'Forbidden' }, headers };
  }

  static NotFound(): HTTPResponse<{ error: string }>;
  static NotFound<T>(body: T, headers?: ApiResponse['headers']): HTTPResponse<T>;
  static NotFound<T>(body?: T, headers?: ApiResponse['headers']): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.NOT_FOUND, body: body ?? { error: 'Not found' }, headers };
  }

  static Conflict(): HTTPResponse<{ error: string }>;
  static Conflict<T>(body: T, headers?: ApiResponse['headers']): HTTPResponse<T>;
  static Conflict<T>(body?: T, headers?: ApiResponse['headers']): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.CONFLICT, body: body ?? { error: 'Conflict' }, headers };
  }

  static UnprocessableContent(): HTTPResponse<{ error: string }>;
  static UnprocessableContent<T>(body: T, headers?: ApiResponse['headers']): HTTPResponse<T>;
  static UnprocessableContent<T>(body?: T, headers?: ApiResponse['headers']): HTTPResponse<T | { error: string }> {
    return {
      statusCode: HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY,
      body: body ?? { error: 'Unprocessable content' },
      headers,
    };
  }

  static InternalServerError(): HTTPResponse<{ error: string }>;
  static InternalServerError<T>(body: T, headers?: ApiResponse['headers']): HTTPResponse<T>;
  static InternalServerError<T>(body?: T, headers?: ApiResponse['headers']): HTTPResponse<T | { error: string }> {
    return {
      statusCode: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
      body: body ?? { error: 'Internal server error' },
      headers,
    };
  }

  static Ok<T>(body: T, headers?: ApiResponse['headers']): HTTPResponse<T> {
    return { statusCode: HTTP_STATUS_CODES.OK, body, headers };
  }

  static Created<T>(body: T, headers?: ApiResponse['headers']): HTTPResponse<T> {
    return { statusCode: HTTP_STATUS_CODES.CREATED, body, headers };
  }

  static Text(body: string, headers?: ApiResponse['headers']): HTTPResponse<string> {
    return { statusCode: HTTP_STATUS_CODES.OK, body, headers: { 'content-type': CONTENT_TYPE_TEXT, ...headers } };
  }

  static Html(body: string, headers?: ApiResponse['headers']): HTTPResponse<string> {
    return { statusCode: HTTP_STATUS_CODES.OK, body, headers: { 'content-type': CONTENT_TYPE_HTML, ...headers } };
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

  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && value.constructor === Object;
  }

  private static isJsonBody(value: unknown): boolean {
    return Response.isPlainObject(value) || Array.isArray(value);
  }

  private static hasContentType(headers: ApiResponse['headers']): boolean {
    return headers !== undefined && Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
  }

  // The content type for a body, from config when set, else inferred from the runtime type
  private static contentTypeForBody(body: unknown, configContentType?: string): string | undefined {
    if (configContentType) {
      if (configContentType.startsWith('text/') && typeof body !== 'string') {
        logger.warn('Response body does not match the configured content type', {
          contentType: configContentType,
          bodyType: typeof body,
        });
      }
      return configContentType;
    }
    if (Response.isJsonBody(body)) return CONTENT_TYPE_JSON;
    if (typeof body === 'string') return CONTENT_TYPE_TEXT;
    return undefined;
  }

  private static buildHTTPResponse(response: unknown, configContentType?: string): HTTPResponse {
    if (Response.isHTTPResponse(response)) {
      // An explicit content type on the response wins over any router or route config
      if (Response.hasContentType(response.headers)) {
        return response;
      }
      const contentType = Response.contentTypeForBody(response.body, configContentType);
      if (!contentType) {
        return response;
      }
      // Create a new object and headers spread last so response.headers override
      return { ...response, headers: { 'content-type': contentType, ...response.headers } };
    }

    // Only an empty plain object returns a 204. An empty array is valid JSON body so is a 200
    const isEmptyObject = Response.isPlainObject(response) && Object.keys(response).length === 0;
    if (response == null || response === '' || response === true || isEmptyObject) {
      return Response.NoContent();
    }

    const contentType = Response.contentTypeForBody(response, configContentType);
    const headers = contentType ? { 'content-type': contentType } : undefined;
    return Response.Ok(response, headers);
  }

  private static bodyToString(body: unknown): string {
    // Invalid/empty values
    if (body === null || body === undefined || typeof body === 'function' || Number.isNaN(body)) {
      return '';
    }
    // Primitives
    if (typeof body === 'string') return body;
    if (typeof body === 'number' || typeof body === 'boolean') {
      return String(body);
    }
    // Objects/arrays
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
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
  create(response: unknown, contentType?: string): FinalizedHTTPResponse {
    const validResponse = Response.buildHTTPResponse(response, contentType);
    return {
      statusCode: validResponse.statusCode,
      body: Response.bodyToString(validResponse.body),
      headers: validResponse.headers,
    };
  }

  unauthorised(message?: string): FinalizedHTTPResponse {
    const body = message ? { error: message } : undefined;
    return this.create(Response.Unauthorised(body));
  }

  forbidden(message?: string): FinalizedHTTPResponse {
    const body = message ? { error: message } : undefined;
    return this.create(Response.Forbidden(body));
  }

  notFound(message?: string): FinalizedHTTPResponse {
    const body = message ? { error: message } : undefined;
    return this.create(Response.NotFound(body));
  }

  badRequest(message?: string): FinalizedHTTPResponse {
    const body = message ? { error: message } : undefined;
    return this.create(Response.BadRequest(body));
  }

  unprocessableContent(message?: string): FinalizedHTTPResponse {
    const body = message ? { error: message } : undefined;
    return this.create(Response.UnprocessableContent(body));
  }

  internalServerError(message?: string): FinalizedHTTPResponse {
    const body = message ? { error: message } : undefined;
    return this.create(Response.InternalServerError(body));
  }
}

// Re-export static methods as standalone functions
export const Ok: typeof Response.Ok = Response.Ok;
export const Created: typeof Response.Created = Response.Created;
export const Text: typeof Response.Text = Response.Text;
export const Html: typeof Response.Html = Response.Html;
export const NoContent: typeof Response.NoContent = Response.NoContent;
export const TemporaryRedirect: typeof Response.TemporaryRedirect = Response.TemporaryRedirect;
export const PermanentRedirect: typeof Response.PermanentRedirect = Response.PermanentRedirect;
export const BadRequest: typeof Response.BadRequest = Response.BadRequest;
export const Unauthorised: typeof Response.Unauthorised = Response.Unauthorised;
export const Forbidden: typeof Response.Forbidden = Response.Forbidden;
export const NotFound: typeof Response.NotFound = Response.NotFound;
export const Conflict: typeof Response.Conflict = Response.Conflict;
export const UnprocessableContent: typeof Response.UnprocessableContent = Response.UnprocessableContent;
export const InternalServerError: typeof Response.InternalServerError = Response.InternalServerError;
