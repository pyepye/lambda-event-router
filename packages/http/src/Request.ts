import type {
  APIGatewayEventRequestContextIAMAuthorizer,
  APIGatewayEventRequestContextJWTAuthorizer,
  APIGatewayEventRequestContextLambdaAuthorizer,
  Context,
} from 'aws-lambda';
import type { InternalRoute } from './PathRouter.js';
import { Response } from './Response.js';
import type { APIGatewayV2EventType, ApiRequest, Schema } from './types.js';

type ValidationResult<T> = { success: true; data: T } | { success: false; error: unknown };

type AuthorizerContext =
  | APIGatewayEventRequestContextJWTAuthorizer
  | APIGatewayEventRequestContextIAMAuthorizer
  | APIGatewayEventRequestContextLambdaAuthorizer<unknown>;

function isJWTAuthorizer(authorizer: AuthorizerContext): authorizer is APIGatewayEventRequestContextJWTAuthorizer {
  return 'jwt' in authorizer;
}

function isIAMAuthorizer(authorizer: AuthorizerContext): authorizer is APIGatewayEventRequestContextIAMAuthorizer {
  return 'iam' in authorizer;
}

export class Request {
  readonly headers: Record<string, string | undefined>;
  readonly method: string;
  readonly path: string;

  private _auth: Record<string, unknown> | undefined;
  private _authParsed = false;

  private _body: unknown;
  private _bodyParsed = false;

  constructor(
    readonly event: APIGatewayV2EventType,
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

  get auth(): ApiRequest['auth'] {
    if (!this._authParsed) {
      this._auth = this.parseAuth();
      this._authParsed = true;
    }
    return this._auth;
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

  private parseAuth(): ApiRequest['auth'] {
    const { requestContext } = this.event;
    if (!('requestContext' in this.event)) {
      return;
    }
    if ('authentication' in requestContext && requestContext.authentication) {
      return { clientCert: requestContext.authentication.clientCert };
    }
    if ('authorizer' in requestContext && requestContext.authorizer) {
      const { authorizer } = requestContext;

      if (isJWTAuthorizer(authorizer)) {
        return authorizer.jwt;
      }
      if (isIAMAuthorizer(authorizer)) {
        return authorizer.iam;
      }
      return { ...requestContext.authorizer };
    }
    return;
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
      auth: this.auth,
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
