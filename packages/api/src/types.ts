import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';

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

export interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

// Helper to infer the type from a Schema
export type InferSchema<T> = T extends Schema<infer R> ? R : never;

export interface ApiRequest<
  TPath = Record<string, string>,
  TQuery = Record<string, string | undefined>,
  TBody = unknown,
> {
  path: TPath;
  query: TQuery;
  body: TBody;
  headers: Record<string, string | undefined>;
  rawEvent: APIGatewayProxyEventV2;
  context: Context;
}

export interface ApiResponse<T = unknown> {
  statusCode: number;
  body: T;
  headers?: Record<string, string>;
}

export interface HTTPResponse<T = unknown> {
  statusCode: number;
  body: T;
  headers?: Record<string, string>;
}

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
