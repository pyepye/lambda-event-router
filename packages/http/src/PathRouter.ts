import type { Middleware } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ApiHandler, ApiRequest, ApiResponse, HttpMethod, PathParams, RouteDefinition } from './types.js';

type BodyMethod = 'POST' | 'PUT' | 'PATCH';
type NoBodyMethod = 'GET' | 'HEAD' | 'DELETE' | 'OPTIONS';

export interface InternalRoute {
  method: HttpMethod;
  path: string;
  pattern: RegExp;
  paramNames: string[];
  customFilter?: (input: unknown) => boolean;
  handler: ApiHandler<unknown, unknown, unknown, unknown>;
  middleware: Middleware<ApiRequest, ApiResponse>[];
  querySchema?: StandardSchemaV1;
  bodySchema?: StandardSchemaV1;
  responseSchema?: StandardSchemaV1;
}

interface PathRouterFilters<TPathString extends string> {
  path: TPathString;
  customFilter?: (input: unknown) => boolean;
}

// Base config shared by all route types
interface BaseRouteConfig<TPathString extends string, TQuery, TResponse> {
  filters: PathRouterFilters<TPathString>;
  querySchema?: StandardSchemaV1<unknown, TQuery>;
  responseSchema?: StandardSchemaV1<unknown, TResponse>;
}

// Config for HTTP methods that don't support a request body (GET, HEAD, DELETE, OPTIONS)
interface NoBodyRouteConfig<TPathString extends string, TPath, TQuery, TResponse>
  extends BaseRouteConfig<TPathString, TQuery, TResponse> {
  handler: ApiHandler<TPath, TQuery, undefined, TResponse>;
  middleware?: Middleware<ApiRequest<TPath, TQuery, undefined>, ApiResponse<TResponse>>[];
}

// Config for HTTP methods that support a request body (POST, PUT, PATCH)
interface BodyRouteConfig<TPathString extends string, TPath, TQuery, TBody, TResponse>
  extends BaseRouteConfig<TPathString, TQuery, TResponse> {
  handler: ApiHandler<TPath, TQuery, TBody, TResponse>;
  middleware?: Middleware<ApiRequest<TPath, TQuery, TBody>, ApiResponse<TResponse>>[];
  bodySchema?: StandardSchemaV1<unknown, TBody>;
}

// Method signature for route (takes full RouteDefinition with method)
export type RouteMethodFn<TReturn = PathRouter> = <
  TPathString extends string,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TBody = never,
  TResponse = unknown,
>(
  route: RouteDefinition<TPathString, TPath, TQuery, TBody, TResponse>,
) => TReturn;

// Method signature for routes with body support
export type BodyRouteMethodFn<TReturn = PathRouter> = <
  TPathString extends string,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TBody = unknown,
  TResponse = unknown,
>(
  config: BodyRouteConfig<TPathString, TPath, TQuery, TBody, TResponse>,
) => TReturn;

// Method signature for routes without body support
export type NoBodyRouteMethodFn<TReturn = PathRouter> = <
  TPathString extends string,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TResponse = unknown,
>(
  config: NoBodyRouteConfig<TPathString, TPath, TQuery, TResponse>,
) => TReturn;

interface RouteMatch {
  route: InternalRoute;
  params: Record<string, string>;
}

export class PathRouter {
  private routes: InternalRoute[] = [];

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from RouteMethodFn<this>
  route: RouteMethodFn<this> = (definition) => {
    const method = definition.filters.method.toUpperCase() as HttpMethod;
    // @ts-expect-error - RouteDefinition uses HTTPFilterInput for customFilter, but addRoute stores as unknown to decouple from HTTP types
    return this.addRoute(method, definition);
  };

  get: NoBodyRouteMethodFn = this.createNoBodyRoute('GET');
  head: NoBodyRouteMethodFn = this.createNoBodyRoute('HEAD');
  delete: NoBodyRouteMethodFn = this.createNoBodyRoute('DELETE');
  options: NoBodyRouteMethodFn = this.createNoBodyRoute('OPTIONS');

  post: BodyRouteMethodFn = this.createBodyRoute('POST');
  put: BodyRouteMethodFn = this.createBodyRoute('PUT');
  patch: BodyRouteMethodFn = this.createBodyRoute('PATCH');

  private createBodyRoute(method: BodyMethod): BodyRouteMethodFn {
    // @ts-expect-error - Generic handler types narrow TPath beyond addRoute's default Record<string, string>
    // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from BodyRouteMethodFn return type
    return (config): this => this.addRoute(method, config);
  }

  private createNoBodyRoute(method: NoBodyMethod): NoBodyRouteMethodFn {
    // @ts-expect-error - Generic handler types narrow TPath beyond addRoute's default Record<string, string>
    // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn return type
    return (config): this => this.addRoute(method, config);
  }

  private addRoute<TPathString extends string>(
    method: HttpMethod,
    config: {
      filters: PathRouterFilters<TPathString>;
      handler: ApiHandler;
      middleware?: Middleware<ApiRequest, ApiResponse>[];
      querySchema?: StandardSchemaV1;
      bodySchema?: StandardSchemaV1;
      responseSchema?: StandardSchemaV1;
    },
  ): this {
    const { path, customFilter } = config.filters;
    const { pattern, paramNames } = this.compilePath(path);

    this.routes.push({
      method,
      path,
      pattern,
      paramNames,
      customFilter,
      handler: config.handler as ApiHandler<unknown, unknown, unknown, unknown>,
      middleware: config.middleware ?? [],
      querySchema: config.querySchema,
      bodySchema: config.bodySchema,
      responseSchema: config.responseSchema,
    });

    return this;
  }

  private compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    const patternStr = path.replace(/:([^/]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });
    return {
      pattern: new RegExp(`^${patternStr}$`),
      paramNames,
    };
  }

  getMethodsForPath(path: string): HttpMethod[] {
    const methods: HttpMethod[] = [];
    for (const route of this.routes) {
      if (route.pattern.test(path) && !methods.includes(route.method)) {
        methods.push(route.method);
      }
    }
    return methods;
  }

  match(method: string, path: string, filterInput?: unknown): RouteMatch | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = path.match(route.pattern);
      if (!match) continue;

      if (route.customFilter && !route.customFilter(filterInput)) {
        continue;
      }

      const params: Record<string, string> = {};
      for (const [idx, name] of route.paramNames.entries()) {
        const paramValue = match[idx + 1];
        /* v8 ignore next -- @preserve - Guard is for TS. Capture group always exists when pattern matches */
        if (paramValue !== undefined) {
          params[name] = paramValue;
        }
      }
      return { route, params };
    }
    return null;
  }
}
