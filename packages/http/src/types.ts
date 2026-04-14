import type { Middleware } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ALBEvent, Context } from 'aws-lambda';

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

export interface HTTPFilterInput<TEvent = unknown> {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  body: string | undefined;
  auth: Auth | undefined;
  event: TEvent;
}

export interface HTTPFilters<TPathString extends string = string> {
  method: AnyHttpMethod;
  path: TPathString;
  customFilter?: (input: HTTPFilterInput) => boolean;
}

export type HTTPMiddleware<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TBody = unknown,
  TResponse = unknown,
> = Middleware<ApiRequest<TPath, TQuery, TBody>, ApiResponse<TResponse>>;

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
  filters: HTTPFilters<TPathString>;
  handler: ApiHandler<TPath, TQuery, TBody, TResponse>;
  middleware?: HTTPMiddleware<TPath, TQuery, TBody, TResponse>[];
  querySchema?: StandardSchemaV1<unknown, TQuery>;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  responseSchema?: StandardSchemaV1<unknown, TResponse>;
}
