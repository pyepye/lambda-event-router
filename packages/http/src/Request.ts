import type { ValidationResult } from '@lambda-event-router/base';
import { safeJsonParse, validateSchemaResult } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type { InternalRoute } from './PathRouter.js';
import { Response } from './Response.js';
import type { ApiRequest, Auth, NormalizedHTTPEvent } from './types.js';

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

    return safeJsonParse(decoded);
  }

  get queryParams(): Record<string, string | undefined> {
    return this.normalizedEvent.query;
  }

  async validate(): Promise<void> {
    const queryValidation = await this.validateQuery();
    if (!queryValidation.success) {
      throw Response.BadRequest(queryValidation.issues);
    }

    const bodyValidation = await this.validateBody();
    if (!bodyValidation.success) {
      throw Response.UnprocessableContent(bodyValidation.issues);
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

  private validateQuery(): Promise<ValidationResult<Record<string, string | undefined>>> {
    return validateSchemaResult(this.queryParams, this.route.querySchema);
  }

  private validateBody(): Promise<ValidationResult<unknown>> {
    return validateSchemaResult(this.body, this.route.bodySchema);
  }
}
