import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { Middleware } from '@lambda-event-router/base';

import type { AuthPreset } from './auth.js';
import type { HTTPException } from './HTTPException.js';

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
type ToNumber<T> = T extends `${infer TNumber extends number}` ? TNumber : never;

export type ErrorStatusCode = ToNumber<`${'4' | '5'}${Digit}${Digit}`>;

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

declare const htmlBrand: unique symbol;

// A plain string never reaches an HTML route by accident, because only Html() makes one of these
export type Html = string & { readonly [htmlBrand]: true };

export type Bytes = Uint8Array | ArrayBuffer;

// An interface has no index signature, so only the first shape takes it. An object literal fails the first
// shape's excess property check, so the second takes it. An object with a statusCode must be an ApiResponse.
// Html carries its brand, and bytes, a Map and a Set carry a Symbol.toStringTag, so neither shape takes them
export type JsonBody =
  | ({ statusCode?: never; readonly [htmlBrand]?: never; readonly [Symbol.toStringTag]?: never } & object)
  | {
      statusCode?: never;
      readonly [htmlBrand]?: never;
      readonly [Symbol.toStringTag]?: never;
      [key: string]: unknown;
    }
  | null
  | undefined;

export type ResponseKind = 'json' | 'html' | 'text' | 'binary';

interface ResponseBodies {
  json: JsonBody;
  html: Html;
  text: string;
  binary: Bytes;
}

export type ResponseBody<TKind extends ResponseKind = ResponseKind> = ResponseBodies[TKind];

type ContentTypeParameters = '' | `;${string}`;
type JsonContentType = `application/json${ContentTypeParameters}` | `${string}/${string}+json${ContentTypeParameters}`;
type IsJsonContentType<TContentType extends string> = Lowercase<TContentType> extends JsonContentType ? true : false;

// A content type that is not a literal cannot be checked, so it is accepted as it is
export type ValidContentType<TKind extends ResponseKind, TContentType extends string> = string extends TContentType
  ? TContentType
  : [TKind] extends ['json']
    ? IsJsonContentType<TContentType> extends true
      ? TContentType
      : `'${TContentType}' is not a JSON content type`
    : IsJsonContentType<TContentType> extends true
      ? `'${TContentType}' is a JSON content type, so it needs responseType 'json'`
      : TContentType;

type IsUnion<T, TAll = T> = T extends unknown ? ([TAll] extends [T] ? false : true) : never;

// For undefined or a union, TypeScript lets the handler return any body, but the route sends only one kind
export type OneKind<TKind extends ResponseKind> =
  true extends IsUnion<TKind>
    ? { responseType: 'responseType must name one kind: json, html, text or binary' }
    : unknown;

export type ResponseTypeOption<TKind extends ResponseKind = ResponseKind, TContentType extends string = string> =
  | TKind
  | { type: TKind; contentType: ValidContentType<TKind, TContentType> };

// The value of a content-type header, whatever the letter case of its name
type ContentTypeHeader<THeaders> = {
  [K in keyof THeaders]: Lowercase<K & string> extends 'content-type' ? THeaders[K] : never;
}[keyof THeaders];

// A JSON content type needs a JSON body, and any other needs a string or bytes
export type BodyForHeaders<THeaders> = [ContentTypeHeader<THeaders>] extends [never]
  ? unknown
  : string extends ContentTypeHeader<THeaders>
    ? unknown
    : IsJsonContentType<ContentTypeHeader<THeaders> & string> extends true
      ? JsonBody
      : string | Bytes;

export type HandlerResponse<TResponse = JsonBody> = ApiResponse<TResponse> | TResponse | HTTPException;

// Any value JSON can carry, because the default JSON error body sends it
export type ErrorContext =
  | string
  | number
  | boolean
  | null
  // Map, Set and bytes have a Symbol.toStringTag, so neither object shape takes them
  | ({ readonly [Symbol.toStringTag]?: never } & object)
  | { readonly [Symbol.toStringTag]?: never; [key: string]: unknown };

export interface ErrorInput {
  statusCode: ErrorStatusCode;
  statusText: string;
  message: string;
  context: ErrorContext | undefined;
}

type ErrorFunction<TBody> = (error: ErrorInput) => TBody | Promise<TBody>;

export interface ErrorFunctions {
  json?: ErrorFunction<ErrorContext>;
  html?: ErrorFunction<Html>;
  text?: ErrorFunction<string>;
}

// Checked on the router options rather than as a constraint on the kind, so an inline errors.html keeps its
// parameter types
export type HtmlRouterErrors<TKind extends ResponseKind> = [TKind] extends ['html']
  ? { errors: { html: ErrorFunction<Html> } }
  : unknown;

// An HTML route needs errors.html, because no default error page could match a site
export type RouteKind<TErrors> = TErrors extends { html: ErrorFunction<Html> }
  ? ResponseKind
  : Exclude<ResponseKind, 'html'>;

export interface NormalizedHTTPEvent<TAuth = unknown> {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  multiValueHeaders: Record<string, string[] | undefined>;
  query: Record<string, string | undefined>;
  multiValueQuery: Record<string, string[] | undefined>;
  body: string | undefined;
  isBase64Encoded: boolean;
  auth: TAuth;
}

export interface FinalizedHTTPResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
  isBase64Encoded: boolean;
}

export interface HTTPAdapter<TEvent, TResult, TAuth = unknown> {
  canHandleEvent(event: unknown): event is TEvent;
  normalize(event: TEvent): NormalizedHTTPEvent<TAuth>;
  buildResult(response: FinalizedHTTPResponse, event: TEvent): TResult;
}

export interface ApiRequest<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TAuth = unknown,
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
  auth: TAuth;
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

export interface HTTPFilterInput<TEvent = unknown, TAuth = unknown> {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  multiValueHeaders: Record<string, string[] | undefined>;
  query: Record<string, string | undefined>;
  multiValueQuery: Record<string, string[] | undefined>;
  body: string | undefined;
  auth: TAuth;
  event: TEvent;
}

export interface HTTPFilters<
  TPathString extends string = string,
  TMethod extends AnyHttpMethod = AnyHttpMethod,
  TAuth = unknown,
> {
  method: TMethod;
  path: ValidPath<TPathString>;
  custom?: (input: HTTPFilterInput<unknown, TAuth>) => boolean | Promise<boolean>;
}

declare const anyResponseKind: unique symbol;

// The default response type of HTTPMiddleware, for middleware that works on a route of any kind
export type AnyResponseKind = typeof anyResponseKind;

// Generic in the response, so the middleware can only answer with what next() gives it or an HTTPException
type AnyKindMiddleware<TRequest> = <TResponse>(
  request: TRequest,
  next: (request: unknown) => Promise<HandlerResponse<TResponse>>,
) => Promise<HandlerResponse<TResponse>>;

// Middleware that reads or builds a body names the response type, which ties it to routes of that kind
export type HTTPMiddleware<
  TPath = Record<string, string>,
  TQuery = Record<string, unknown>,
  TAuth = unknown,
  TBody = unknown,
  TResponse = AnyResponseKind,
> = [TResponse] extends [AnyResponseKind]
  ? AnyKindMiddleware<ApiRequest<TPath, TQuery, TAuth, TBody>>
  : Middleware<ApiRequest<TPath, TQuery, TAuth, TBody>, HandlerResponse<TResponse>>;

// A handler with no return statement returns Promise<void>, which is allowed only where the response can be undefined
type NoReturn<TResponse> = undefined extends TResponse ? Promise<void> : never;

export type ApiHandler<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TAuth = unknown,
  TBody = unknown,
  TResponse = JsonBody,
> = (request: ApiRequest<TPath, TQuery, TAuth, TBody>) => Promise<HandlerResponse<TResponse>> | NoReturn<TResponse>;

// A route passed straight to route() with no responseType takes the router's kind
export interface RouteConfig<
  TPathString extends string = string,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TAuth = unknown,
  TBody = unknown,
  TResponse = JsonBody,
  TMethod extends AnyHttpMethod = AnyHttpMethod,
  TRawAuth = TAuth,
  TKind extends ResponseKind = 'json',
  TContentType extends string = string,
> {
  filters: HTTPFilters<TPathString, TMethod, TRawAuth>;
  auth?: AuthPreset<TRawAuth, TAuth>;
  responseType?: ResponseTypeOption<TKind, TContentType>;
  handler: ApiHandler<TPath, TQuery, NoInfer<TAuth>, NoInfer<TBody>, NoInfer<TResponse>>;
  middleware?: HTTPMiddleware<TPath, TQuery, NoInfer<TAuth>, NoInfer<TBody>, NoInfer<TResponse>>[];
  querySchema?: StandardSchemaV1<unknown, TQuery>;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  responseSchema?: StandardSchemaV1<unknown, TResponse>;
}

// A route value always names its kind, so a router with a different default still sends what its types say
export interface RouteDefinition<
  TPathString extends string = string,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TAuth = unknown,
  TBody = unknown,
  TResponse = JsonBody,
  TMethod extends AnyHttpMethod = AnyHttpMethod,
  TRawAuth = TAuth,
  TKind extends ResponseKind = 'json',
  TContentType extends string = string,
> extends RouteConfig<TPathString, TPath, TQuery, TAuth, TBody, TResponse, TMethod, TRawAuth, TKind, TContentType> {
  responseType: ResponseTypeOption<TKind, TContentType>;
}
