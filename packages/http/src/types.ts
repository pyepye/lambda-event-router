import type { InferSchema, Schema } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';

// HTTP method types - more restrictive than aws-lambda's string for better type safety
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type LowercaseHttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';
export type AnyHttpMethod = HttpMethod | LowercaseHttpMethod;

// Extract path params from route string
// "/items/:itemId/sub/:subId" -> { itemId: string; subId: string }
type ExtractParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof ExtractParams<Rest>]: string }
  : T extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : Record<string, never>;

// Clean up the extracted params into a proper object type
export type PathParams<T extends string> = ExtractParams<T> extends infer O ? { [K in keyof O]: O[K] } : never;

export type { InferSchema, Schema };

export interface Auth {
  claims?: Record<string, unknown>;
  scopes?: string[];
  principalId?: string;
  context?: Record<string, unknown>;
  clientCert?: Record<string, unknown>;
  iam?: Record<string, unknown>;
}

export interface NormalizedHTTPEvent {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  body: string | undefined;
  isBase64Encoded: boolean;
  auth: Auth | undefined;
}

export interface FinalizedHTTPResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
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
  path: TPath;
  query: TQuery;
  body: TBody;
  auth: Auth | undefined;
  headers: Record<string, string | undefined>;
  event: TEvent;
  context: Context;
}

export interface ApiResponse<T = unknown> {
  statusCode: number;
  body: T;
  headers?: Record<string, string>;
}

export type HTTPResponse<T = unknown> = ApiResponse<T>;

export type ApiHandler<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TBody = unknown,
  TResponse = unknown,
> = (request: ApiRequest<TPath, TQuery, TBody>) => Promise<ApiResponse<TResponse>>;

export interface RouteDefinition<
  TPathString extends string = string,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TBody = unknown,
  TResponse = unknown,
> {
  method: AnyHttpMethod;
  path: TPathString;
  handler: ApiHandler<TPath, TQuery, TBody, TResponse>;
  pathSchema?: Schema<TPath>;
  querySchema?: Schema<TQuery>;
  bodySchema?: Schema<TBody>;
  responseSchema?: Schema<TResponse>;
}
