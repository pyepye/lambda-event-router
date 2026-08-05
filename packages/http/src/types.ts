import type { ALBEvent, Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { Middleware } from '@lambda-event-router/base';

// HTTP method types - more restrictive than aws-lambda's string for better type safety
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type LowercaseHttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';
export type AnyHttpMethod = HttpMethod | LowercaseHttpMethod;
export type BodyMethod = 'POST' | 'PUT' | 'PATCH';
export type NoBodyMethod = 'GET' | 'HEAD' | 'DELETE' | 'OPTIONS';

// The body a route without a bodySchema receives
export type DefaultBody<TMethod extends AnyHttpMethod> = TMethod extends BodyMethod | Lowercase<BodyMethod>
  ? unknown
  : undefined;

type Characters<T extends string> = T extends `${infer Char}${infer Rest}` ? Char | Characters<Rest> : never;
type Letter = Characters<'abcdefghijklmnopqrstuvwxyz'>;
type Digit = Characters<'0123456789'>;
// Matches PARAM_NAME in PathRouter: an ASCII identifier
type ParamNameStart = Letter | Uppercase<Letter> | '_' | '$';
type ParamNameChar = ParamNameStart | Digit;

// Reads the param name from the start of the text after a ':'
type ReadParamName<T extends string, TName extends string = ''> = T extends `${infer Char}${infer Rest}`
  ? Char extends ParamNameChar
    ? ReadParamName<Rest, `${TName}${Char}`>
    : TName
  : TName;

// The text after each ':' in the path, where a param name should start
type AfterColons<T extends string> = T extends `${string}:${infer After}` ? After | AfterColons<After> : never;

type ParamNames<T extends string> =
  AfterColons<T> extends infer After extends string
    ? After extends `${ParamNameStart}${string}`
      ? ReadParamName<After>
      : never
    : never;

type HasUnnamedParam<T extends string> = true extends (
  AfterColons<T> extends infer After
    ? After extends `${ParamNameStart}${string}`
      ? false
      : true
    : never
)
  ? true
  : false;

// A path is accepted as is, unless a ':' in it has no param name. Then the error names the path
export type ValidPath<T extends string> =
  HasUnnamedParam<T> extends true ? `Path '${T}' has a ':' without a param name` : T;

export type PathParams<T extends string> = { [K in ParamNames<T>]: string };

export type HandlerResponse<TResponse = unknown> = ApiResponse<TResponse> | TResponse;

// TODO: Does this need to be more dynamic based on the type?
//       If not these types should all come from the actual interfaces like targetGroupArn
export interface Auth {
  claims?: Record<string, unknown>;
  scopes?: string[];
  principalId?: string;
  context?: Record<string, unknown>;
  clientCert?: Record<string, unknown>;
  iam?: Record<string, unknown>;
  apiKey?: string;
  apiKeyId?: string;
  targetGroupArn?: ALBEvent['requestContext']['elb']['targetGroupArn'];
}

export interface NormalizedHTTPEvent {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  multiValueHeaders: Record<string, string[] | undefined>;
  query: Record<string, string | undefined>;
  multiValueQuery: Record<string, string[] | undefined>;
  body: string | undefined;
  isBase64Encoded: boolean;
  auth: Auth | undefined;
}

export interface FinalizedHTTPResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
  isBase64Encoded: boolean;
}

export interface HTTPAdapter<TEvent, TResult> {
  canHandleEvent(event: unknown): event is TEvent;
  normalize(event: TEvent): NormalizedHTTPEvent;
  buildResult(response: FinalizedHTTPResponse, event: TEvent): TResult;
}

export interface ApiRequest<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TBody = unknown,
  TEvent = unknown,
> {
  method: string;
  path: TPath;
  rawPath: string;
  query: TQuery;
  multiValueQuery: Record<string, string[] | undefined>;
  body: TBody;
  rawBody: string | undefined;
  isBase64Encoded: boolean;
  auth: Auth | undefined;
  headers: Record<string, string | undefined>;
  multiValueHeaders: Record<string, string[] | undefined>;
  event: TEvent;
  context: Context;
}

export interface ApiResponse<T = unknown> {
  statusCode: number;
  body: T;
  headers?: Record<string, string>;
}

export type HTTPResponse<T = unknown> = ApiResponse<T>;

export interface HTTPFilterInput<TEvent = unknown> {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  multiValueHeaders: Record<string, string[] | undefined>;
  query: Record<string, string | undefined>;
  multiValueQuery: Record<string, string[] | undefined>;
  body: string | undefined;
  auth: Auth | undefined;
  event: TEvent;
}

export interface HTTPFilters<TPathString extends string = string, TMethod extends AnyHttpMethod = AnyHttpMethod> {
  method: TMethod;
  path: ValidPath<TPathString>;
  custom?: (input: HTTPFilterInput) => boolean | Promise<boolean>;
}

export type HTTPMiddleware<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TBody = unknown,
  TResponse = unknown,
> = Middleware<ApiRequest<TPath, TQuery, TBody>, HandlerResponse<TResponse>>;

export type ApiHandler<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TBody = unknown,
  TResponse = unknown,
> = (request: ApiRequest<TPath, TQuery, TBody>) => Promise<HandlerResponse<TResponse>>;

export interface RouteDefinition<
  TPathString extends string = string,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TBody = unknown,
  TResponse = unknown,
  TMethod extends AnyHttpMethod = AnyHttpMethod,
> {
  filters: HTTPFilters<TPathString, TMethod>;
  handler: ApiHandler<TPath, TQuery, NoInfer<TBody>, TResponse>;
  middleware?: HTTPMiddleware<TPath, TQuery, NoInfer<TBody>, TResponse>[];
  querySchema?: StandardSchemaV1<unknown, TQuery>;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  responseSchema?: StandardSchemaV1<unknown, TResponse>;
}
