import type { Context } from 'aws-lambda';

import { safeJsonParse, validateSchemaResult } from '@lambda-event-router/base';

import type { InternalRoute } from './PathRouter.js';
import { Response } from './Response.js';
import type { ApiRequest, Auth, NormalizedHTTPEvent } from './types.js';

export class Request {
  readonly headers: Record<string, string | undefined>;
  readonly multiValueHeaders: Record<string, string[] | undefined>;
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
    this.multiValueHeaders = normalizedEvent.multiValueHeaders;
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

    const contentType = this.requestContentType();
    // A text body is kept verbatim, a form is a flat object, everything else stays JSON
    if (contentType.startsWith('text/')) {
      return decoded;
    }
    if (contentType.startsWith('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(decoded));
    }
    return safeJsonParse(decoded);
  }

  private requestContentType(): string {
    const header = Object.entries(this.headers).find(([key]) => key.toLowerCase() === 'content-type');
    return header?.[1]?.toLowerCase() ?? '';
  }

  get queryParams(): Record<string, string | undefined> {
    return this.normalizedEvent.query;
  }

  get multiValueQueryParams(): Record<string, string[] | undefined> {
    return this.normalizedEvent.multiValueQuery;
  }

  async validateQuery(): Promise<Record<string, string | undefined>> {
    const result = await validateSchemaResult(this.queryParams, this.route.querySchema);
    if (!result.success) {
      throw Response.BadRequest(result.issues);
    }
    return result.data;
  }

  async validateBody(): Promise<unknown> {
    const result = await validateSchemaResult(this.body, this.route.bodySchema);
    if (!result.success) {
      throw Response.UnprocessableContent(result.issues);
    }
    return result.data;
  }

  buildApiRequest(query: Record<string, string | undefined>, body: unknown): ApiRequest {
    return {
      method: this.method,
      path: this.pathParams,
      rawPath: this.path,
      query,
      multiValueQuery: this.multiValueQueryParams,
      auth: this.auth,
      body,
      headers: this.headers,
      multiValueHeaders: this.multiValueHeaders,
      event: this.rawEvent,
      context: this.context,
    };
  }
}
