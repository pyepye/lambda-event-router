// import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from "aws-lambda";
import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { HTTP_STATUS_CODES } from './constants.js';
import type { HTTPResponse } from './types.js';

export class Response {
  // private event: APIGatewayProxyEventV2 | undefined;
  // private context: Context | undefined;

  // setRequestContext(event: APIGatewayProxyEventV2, context: Context): void {
  //   this.event = event;
  //   this.context = context;
  // }

  // Static factory methods for creating raw response objects (body not yet stringified)
  static BadRequest(): HTTPResponse<{ error: string }>;
  static BadRequest<T>(body: T): HTTPResponse<T>;
  static BadRequest<T>(body?: T): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.BAD_REQUEST, body: body ?? { error: 'Bad request' } };
  }

  static Unauthorised(): HTTPResponse<{ error: string }>;
  static Unauthorised<T>(body: T): HTTPResponse<T>;
  static Unauthorised<T>(body?: T): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.UNAUTHORIZED, body: body ?? { error: 'Unauthorised' } };
  }

  static Forbidden(): HTTPResponse<{ error: string }>;
  static Forbidden<T>(body: T): HTTPResponse<T>;
  static Forbidden<T>(body?: T): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.FORBIDDEN, body: body ?? { error: 'Forbidden' } };
  }

  static NotFound(): HTTPResponse<{ error: string }>;
  static NotFound<T>(body: T): HTTPResponse<T>;
  static NotFound<T>(body?: T): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.NOT_FOUND, body: body ?? { error: 'Not found' } };
  }

  static Conflict(): HTTPResponse<{ error: string }>;
  static Conflict<T>(body: T): HTTPResponse<T>;
  static Conflict<T>(body?: T): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.CONFLICT, body: body ?? { error: 'Conflict' } };
  }

  static UnprocessableContent(): HTTPResponse<{ error: string }>;
  static UnprocessableContent<T>(body: T): HTTPResponse<T>;
  static UnprocessableContent<T>(body?: T): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY, body: body ?? { error: 'Unprocessable content' } };
  }

  static InternalServerError(): HTTPResponse<{ error: string }>;
  static InternalServerError<T>(body: T): HTTPResponse<T>;
  static InternalServerError<T>(body?: T): HTTPResponse<T | { error: string }> {
    return { statusCode: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, body: body ?? { error: 'Internal server error' } };
  }

  static Ok<T>(body: T): HTTPResponse<T> {
    return { statusCode: HTTP_STATUS_CODES.OK, body };
  }

  static Created<T>(body: T): HTTPResponse<T> {
    return { statusCode: HTTP_STATUS_CODES.CREATED, body };
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

  private static buildHTTPResponse(response: unknown): HTTPResponse {
    if (Response.isHTTPResponse(response)) {
      return response;
    }

    const isEmptyObject =
      typeof response === 'object' &&
      response !== null &&
      response.constructor === Object &&
      Object.keys(response).length === 0;

    if (response == null || response === '' || response === true || isEmptyObject) {
      return Response.NoContent();
    }

    return Response.Ok(response);
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

  // Instance methods for building complete API Gateway responses
  async create(response: unknown): Promise<APIGatewayProxyResultV2> {
    const validResponse = Response.buildHTTPResponse(response);
    return {
      statusCode: validResponse.statusCode,
      body: Response.bodyToString(validResponse.body),
      headers: validResponse.headers,
    };
  }

  async unauthorised(message?: string): Promise<APIGatewayProxyResultV2> {
    const body = message ? { error: message } : undefined;
    return this.create(Response.Unauthorised(body));
  }

  async forbidden(message?: string): Promise<APIGatewayProxyResultV2> {
    const body = message ? { error: message } : undefined;
    return this.create(Response.Forbidden(body));
  }

  async notFound(message?: string): Promise<APIGatewayProxyResultV2> {
    const body = message ? { error: message } : undefined;
    return this.create(Response.NotFound(body));
  }

  async badRequest(message?: string): Promise<APIGatewayProxyResultV2> {
    const body = message ? { error: message } : undefined;
    return this.create(Response.BadRequest(body));
  }

  async unprocessableContent(message?: string): Promise<APIGatewayProxyResultV2> {
    const body = message ? { error: message } : undefined;
    return this.create(Response.UnprocessableContent(body));
  }

  async internalServerError(message?: string): Promise<APIGatewayProxyResultV2> {
    const body = message ? { error: message } : undefined;
    return this.create(Response.InternalServerError(body));
  }
}

// Re-export static methods as standalone functions
export const Ok = Response.Ok;
export const Created = Response.Created;
export const NoContent = Response.NoContent;
export const TemporaryRedirect = Response.TemporaryRedirect;
export const PermanentRedirect = Response.PermanentRedirect;
export const BadRequest = Response.BadRequest;
export const Unauthorised = Response.Unauthorised;
export const Forbidden = Response.Forbidden;
export const NotFound = Response.NotFound;
export const Conflict = Response.Conflict;
export const UnprocessableContent = Response.UnprocessableContent;
export const InternalServerError = Response.InternalServerError;
