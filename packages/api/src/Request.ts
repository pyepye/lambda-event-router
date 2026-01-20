import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import type { InternalRoute } from './PathRouter.js';
import { Response } from './Response.js';
import type { ApiRequest, Schema } from './types.js';

type ValidationResult<T> = { success: true; data: T } | { success: false; error: unknown };

export class Request {
  readonly headers: Record<string, string | undefined>;
  readonly method: string;
  readonly path: string;

  private _body: unknown;
  private _bodyParsed = false;

  constructor(
    readonly event: APIGatewayProxyEventV2,
    readonly context: Context,
    readonly route: InternalRoute,
    readonly pathParams: Record<string, string>,
  ) {
    this.headers = event.headers;
    this.method = event.requestContext.http.method;
    this.path = event.rawPath;
  }

  get body(): unknown {
    if (!this._bodyParsed) {
      this._body = this.parseBody();
      this._bodyParsed = true;
    }
    return this._body;
  }

  private parseBody(): unknown {
    const { body, isBase64Encoded } = this.event;

    if (!body) return null;

    const decoded = isBase64Encoded ? Buffer.from(body, 'base64').toString('utf-8') : body;

    try {
      return JSON.parse(decoded);
    } catch {
      return decoded;
    }
  }

  get queryParams(): Record<string, string | undefined> {
    return this.event.queryStringParameters ?? {};
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
      body: this.body,
      headers: this.headers,
      event: this.event,
      context: this.context,
    };
  }

  private validatePath(): ValidationResult<Record<string, string>> {
    return this.validateWithSchema<Record<string, string>>(this.route.pathSchema, this.pathParams);
  }

  private validateQuery(): ValidationResult<Record<string, string | undefined>> {
    return this.validateWithSchema<Record<string, string | undefined>>(this.route.querySchema, this.queryParams);
  }

  private validateBody(): ValidationResult<unknown> {
    return this.validateWithSchema<unknown>(this.route.bodySchema, this.body);
  }

  private validateWithSchema<T>(schema: Schema<unknown> | undefined, data: unknown): ValidationResult<T> {
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
