import type { Context } from 'aws-lambda';
import type { InternalRoute } from './PathRouter.js';
import { Response } from './Response.js';
import type { ApiRequest, Auth, NormalizedHTTPEvent, Schema } from './types.js';

type ValidationResult<T> = { success: true; data: T } | { success: false; error: unknown };

export class Request {
  readonly headers: Record<string, string | undefined>;
  readonly method: string;
  readonly path: string;

  private _body: unknown;
  private _bodyParsed = false;

  constructor(
    readonly normalizedEvent: NormalizedHTTPEvent,
    readonly rawEvent: unknown,
    readonly context: Context,
    readonly route: InternalRoute,
    readonly pathParams: Record<string, string>,
  ) {
    this.headers = normalizedEvent.headers;
    this.method = normalizedEvent.method;
    this.path = normalizedEvent.path;
  }

  get body(): unknown {
    if (!this._bodyParsed) {
      this._body = this.parseBody();
      this._bodyParsed = true;
    }
    return this._body;
  }

  get auth(): Auth | undefined {
    return this.normalizedEvent.auth;
  }

  private parseBody(): unknown {
    const { body, isBase64Encoded } = this.normalizedEvent;

    if (!body) return null;

    const decoded = isBase64Encoded ? Buffer.from(body, 'base64').toString('utf-8') : body;

    try {
      return JSON.parse(decoded);
    } catch {
      return decoded;
    }
  }

  get queryParams(): Record<string, string | undefined> {
    return this.normalizedEvent.query;
  }

  validate(): void {
    const pathValidation = this.validatePath();
    if (!pathValidation.success) {
      throw Response.NotFound(pathValidation.error);
    }

    const queryValidation = this.validateQuery();
    if (!queryValidation.success) {
      throw Response.BadRequest(queryValidation.error);
    }

    const bodyValidation = this.validateBody();
    if (!bodyValidation.success) {
      throw Response.UnprocessableContent(bodyValidation.error);
    }
  }

  buildApiRequest(): ApiRequest {
    return {
      path: this.pathParams,
      query: this.queryParams,
      auth: this.auth,
      body: this.body,
      headers: this.headers,
      event: this.rawEvent,
      context: this.context,
    };
  }

  private validatePath(): ValidationResult<Record<string, string>> {
    return this.validateSchema<Record<string, string>>(this.route.pathSchema, this.pathParams);
  }

  private validateQuery(): ValidationResult<Record<string, string | undefined>> {
    return this.validateSchema<Record<string, string | undefined>>(this.route.querySchema, this.queryParams);
  }

  private validateBody(): ValidationResult<unknown> {
    return this.validateSchema<unknown>(this.route.bodySchema, this.body);
  }

  private validateSchema<T>(schema: Schema<unknown> | undefined, data: unknown): ValidationResult<T> {
    if (!schema) {
      return { success: true, data: data as T };
    }
    const result = schema.safeParse(data);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: result.data as T };
  }
}
