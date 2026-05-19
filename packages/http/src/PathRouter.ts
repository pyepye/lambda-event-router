import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { Middleware } from '@lambda-event-router/base';

import type { ApiHandler, ApiRequest, HandlerResponse, HttpMethod, PathParams, RouteDefinition } from './types.js';

type BodyMethod = 'POST' | 'PUT' | 'PATCH';
type NoBodyMethod = 'GET' | 'HEAD' | 'DELETE' | 'OPTIONS';

export interface InternalRoute {
  method: HttpMethod;
  path: string;
  pattern: RegExp;
  pathParamNames: string[]; // path param names in order, mapped to the pattern's capture groups
  pathParamMask: boolean[]; // true where a segment is a path param, walked left to right to rank specificity
  matchShape: string; // method + path with params flattened to ':'; equal shapes match the same requests
  custom?: (input: unknown) => boolean | Promise<boolean>;
  handler: ApiHandler<unknown, unknown, unknown, unknown>;
  middleware: Middleware<ApiRequest, HandlerResponse>[];
  querySchema?: StandardSchemaV1;
  bodySchema?: StandardSchemaV1;
  responseSchema?: StandardSchemaV1;
}

interface PathRouterFilters<TPathString extends string> {
  path: TPathString;
  custom?: (input: unknown) => boolean | Promise<boolean>;
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
  middleware?: Middleware<ApiRequest<TPath, TQuery, undefined>, HandlerResponse<TResponse>>[];
}

// Config for HTTP methods that support a request body (POST, PUT, PATCH)
interface BodyRouteConfig<TPathString extends string, TPath, TQuery, TBody, TResponse>
  extends BaseRouteConfig<TPathString, TQuery, TResponse> {
  handler: ApiHandler<TPath, TQuery, TBody, TResponse>;
  middleware?: Middleware<ApiRequest<TPath, TQuery, TBody>, HandlerResponse<TResponse>>[];
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

// Remove the trailing comma from any paths when matching
// This will mean `path: '/item'` and `path: "/item/"` match API request to both /item and /item/
function normalizePath(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function describePathSegments(method: HttpMethod, path: string): { pathParamMask: boolean[]; matchShape: string } {
  // Split a normalized path into its segments and mark each a path param or a literal.
  const segments = path === '/' ? [] : path.replace(/^\//, '').split('/');
  const pathParamMask = segments.map((segment) => segment.startsWith(':'));
  const tokens = segments.map((segment) => (segment.startsWith(':') ? ':' : segment));
  return { pathParamMask, matchShape: `${method} /${tokens.join('/')}` };
}

// Rank routes most specific first. Literal segments should sort above a param at the same position (compared
// left to right). This means the first position where the two disagree decides.
function compareRouteSpecificity(a: InternalRoute, b: InternalRoute): number {
  const length = Math.min(a.pathParamMask.length, b.pathParamMask.length);
  for (let index = 0; index < length; index++) {
    if (a.pathParamMask[index] !== b.pathParamMask[index]) {
      return a.pathParamMask[index] ? 1 : -1;
    }
  }
  // Routes that agree on every compared position are equal and are kept in the same order
  return 0;
}

export class PathRouter {
  private routes: InternalRoute[] = [];
  private routesSorted = false;

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from RouteMethodFn<this>
  route: RouteMethodFn<this> = (definition) => {
    const method = definition.filters.method.toUpperCase() as HttpMethod;
    // @ts-expect-error - RouteDefinition uses HTTPFilterInput for custom, but addRoute stores as unknown to decouple from HTTP types
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
      middleware?: Middleware<ApiRequest, HandlerResponse>[];
      querySchema?: StandardSchemaV1;
      bodySchema?: StandardSchemaV1;
      responseSchema?: StandardSchemaV1;
    },
  ): this {
    const { custom } = config.filters;
    const path = normalizePath(config.filters.path);
    const { pattern, pathParamNames } = this.compilePath(path);
    const { pathParamMask, matchShape } = describePathSegments(method, path);

    // Error if we can't work out the order of 2 routes and there is no custom to tell them apart
    if (custom === undefined) {
      const clash = this.routes.find((route) => route.matchShape === matchShape && route.custom === undefined);
      if (clash) {
        throw new Error(
          `Route ${method} ${path} is ambiguous with ${method} ${clash.path}: both match the same paths and cannot be ranked by specificity. Give them different paths, or add a custom to one.`,
        );
      }
    }

    this.routes.push({
      method,
      path,
      pattern,
      pathParamNames,
      pathParamMask,
      matchShape,
      custom,
      handler: config.handler as ApiHandler<unknown, unknown, unknown, unknown>,
      middleware: config.middleware ?? [],
      querySchema: config.querySchema,
      bodySchema: config.bodySchema,
      responseSchema: config.responseSchema,
    });
    this.routesSorted = false;

    return this;
  }

  // Order routes most specific first, once, before the next match. Registration flips the flag so
  // the next call re-sorts.
  private sortRoutes(): void {
    if (this.routesSorted) return;
    this.routes.sort(compareRouteSpecificity);
    this.routesSorted = true;
  }

  private compilePath(path: string): { pattern: RegExp; pathParamNames: string[] } {
    const pathParamNames: string[] = [];
    // Match either a :param or a run of literal characters, and escape the literals so a regex
    // metacharacter in a path (a dot in a version, a file extension, a '+') matches itself.
    const patternStr = path.replace(/:([^/]+)|[^:]+/g, (segment, paramName?: string) => {
      if (paramName !== undefined) {
        pathParamNames.push(paramName);
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    return {
      pattern: new RegExp(`^${patternStr}$`),
      pathParamNames,
    };
  }

  getMethodsForPath(path: string): HttpMethod[] {
    this.sortRoutes();
    const normalizedPath = normalizePath(path);
    const methods: HttpMethod[] = [];
    for (const route of this.routes) {
      if (route.pattern.test(normalizedPath) && !methods.includes(route.method)) {
        methods.push(route.method);
      }
    }
    return methods;
  }

  async match(method: string, path: string, filterInput?: unknown): Promise<RouteMatch | null> {
    this.sortRoutes();
    const normalizedPath = normalizePath(path);
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = normalizedPath.match(route.pattern);
      if (!match) continue;

      if (route.custom && !(await route.custom(filterInput))) {
        continue;
      }

      const params: Record<string, string> = {};
      for (const [idx, name] of route.pathParamNames.entries()) {
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
