import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { Middleware } from '@lambda-event-router/base';

import type { AuthPreset } from './auth.js';
import type {
  AnyHttpMethod,
  ApiHandler,
  ApiRequest,
  BodyMethod,
  DefaultBody,
  HandlerResponse,
  HTTPFilterInput,
  HttpMethod,
  NoBodyMethod,
  OneKind,
  PathParams,
  ResponseBody,
  ResponseKind,
  ResponseTypeOption,
  RouteConfig,
  RouteKind,
  ValidPath,
} from './types.js';

type SegmentKind = 'literal' | 'mixed' | 'param';

export interface InternalRoute<TAuth = unknown> {
  method: HttpMethod;
  path: string;
  pattern: RegExp;
  pathParamNames: string[]; // path param names in order, mapped to the pattern's capture groups
  segmentKinds: SegmentKind[]; // one per segment, walked left to right to rank specificity
  registrationIndex: number; // position the route was registered in, which ranking does not disturb
  custom?: (input: HTTPFilterInput<unknown, TAuth>) => boolean | Promise<boolean>;
  handler: (request: ApiRequest<unknown, unknown, TAuth, unknown>) => Promise<HandlerResponse<ResponseBody>>;
  middleware: Middleware<
    ApiRequest<Record<string, string>, Record<string, string | undefined>, TAuth>,
    HandlerResponse<ResponseBody>
  >[];
  responseType?: ResponseTypeOption;
  querySchema?: StandardSchemaV1;
  bodySchema?: StandardSchemaV1;
  responseSchema?: StandardSchemaV1;
  auth?: AuthPreset<TAuth, TAuth>;
}

interface PathRouterFilters<TPathString extends string, TAuth> {
  path: ValidPath<TPathString>;
  custom?: (input: HTTPFilterInput<unknown, TAuth>) => boolean | Promise<boolean>;
}

// Base config shared by all route types. The filters see the auth the adapter produced, and the
// handler sees what the auth preset hands on
interface BaseRouteConfig<
  TPathString extends string,
  TQuery,
  TRawAuth,
  TRouteAuth,
  TResponse,
  TKind extends ResponseKind,
  TContentType extends string,
> {
  filters: PathRouterFilters<TPathString, TRawAuth>;
  auth?: AuthPreset<TRawAuth, TRouteAuth>;
  responseType?: ResponseTypeOption<TKind, TContentType>;
  querySchema?: StandardSchemaV1<unknown, TQuery>;
  responseSchema?: StandardSchemaV1<unknown, TResponse>;
}

// Config for HTTP methods that read a request body only with a bodySchema (GET, HEAD, DELETE, OPTIONS)
interface NoBodyRouteConfig<
  TPathString extends string,
  TPath,
  TQuery,
  TRawAuth,
  TRouteAuth,
  TResponse,
  TBody,
  TKind extends ResponseKind,
  TContentType extends string,
> extends BaseRouteConfig<TPathString, TQuery, TRawAuth, TRouteAuth, TResponse, TKind, TContentType> {
  handler: ApiHandler<TPath, TQuery, NoInfer<TRouteAuth>, NoInfer<TBody>, NoInfer<TResponse>>;
  middleware?: Middleware<
    ApiRequest<TPath, TQuery, NoInfer<TRouteAuth>, NoInfer<TBody>>,
    HandlerResponse<NoInfer<TResponse>>
  >[];
  bodySchema?: StandardSchemaV1<unknown, TBody>;
}

// Config for HTTP methods that support a request body (POST, PUT, PATCH)
interface BodyRouteConfig<
  TPathString extends string,
  TPath,
  TQuery,
  TRawAuth,
  TRouteAuth,
  TBody,
  TResponse,
  TKind extends ResponseKind,
  TContentType extends string,
> extends BaseRouteConfig<TPathString, TQuery, TRawAuth, TRouteAuth, TResponse, TKind, TContentType> {
  handler: ApiHandler<TPath, TQuery, NoInfer<TRouteAuth>, NoInfer<TBody>, NoInfer<TResponse>>;
  middleware?: Middleware<
    ApiRequest<TPath, TQuery, NoInfer<TRouteAuth>, NoInfer<TBody>>,
    HandlerResponse<NoInfer<TResponse>>
  >[];
  bodySchema?: StandardSchemaV1<unknown, TBody>;
}

// Method signature for route (takes a full RouteConfig with method)
export type RouteMethodFn<
  TReturn = PathRouter,
  TAuth = unknown,
  TDefaultAuth extends TAuth = TAuth,
  TDefaultKind extends ResponseKind = 'json',
  TErrors = unknown,
> = <
  TPathString extends string,
  TMethod extends AnyHttpMethod,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TBody = DefaultBody<TMethod>,
  TKind extends RouteKind<TErrors> = TDefaultKind & RouteKind<TErrors>,
  TContentType extends string = string,
  TResponse extends ResponseBody<TKind> = ResponseBody<TKind>,
  TRouteAuth extends TAuth = TDefaultAuth,
>(
  route: RouteConfig<TPathString, TPath, TQuery, TRouteAuth, TBody, TResponse, TMethod, TAuth, TKind, TContentType> &
    OneKind<NoInfer<TKind>>,
) => TReturn;

// Method signature for routes with body support
export type BodyRouteMethodFn<
  TReturn = PathRouter,
  TAuth = unknown,
  TDefaultAuth extends TAuth = TAuth,
  TDefaultKind extends ResponseKind = 'json',
  TErrors = unknown,
> = <
  TPathString extends string,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TBody = unknown,
  TKind extends RouteKind<TErrors> = TDefaultKind & RouteKind<TErrors>,
  TContentType extends string = string,
  TResponse extends ResponseBody<TKind> = ResponseBody<TKind>,
  TRouteAuth extends TAuth = TDefaultAuth,
>(
  config: BodyRouteConfig<TPathString, TPath, TQuery, TAuth, TRouteAuth, TBody, TResponse, TKind, TContentType> &
    OneKind<NoInfer<TKind>>,
) => TReturn;

// Method signature for routes without body support
export type NoBodyRouteMethodFn<
  TReturn = PathRouter,
  TAuth = unknown,
  TDefaultAuth extends TAuth = TAuth,
  TDefaultKind extends ResponseKind = 'json',
  TErrors = unknown,
> = <
  TPathString extends string,
  TPath = PathParams<TPathString>,
  TQuery = Record<string, string | undefined>,
  TKind extends RouteKind<TErrors> = TDefaultKind & RouteKind<TErrors>,
  TContentType extends string = string,
  TResponse extends ResponseBody<TKind> = ResponseBody<TKind>,
  TBody = undefined,
  TRouteAuth extends TAuth = TDefaultAuth,
>(
  config: NoBodyRouteConfig<TPathString, TPath, TQuery, TAuth, TRouteAuth, TResponse, TBody, TKind, TContentType> &
    OneKind<NoInfer<TKind>>,
) => TReturn;

interface RouteMatch<TAuth> {
  route: InternalRoute<TAuth>;
  params: Record<string, string>;
}

// Remove the trailing comma from any paths when matching
// This will mean `path: '/item'` and `path: "/item/"` match API request to both /item and /item/
function normalizePath(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

// A param name is an ASCII identifier: a letter, '_' or '$', then letters, digits, '_' or '$'
const PARAM_NAME = '[A-Za-z_$][A-Za-z0-9_$]*';
// A whole segment that is one param and nothing else, like ':id'
const BARE_PARAM_SEGMENT: RegExp = new RegExp(`^:${PARAM_NAME}$`);
// Either a :param, a ':' with no valid name after it, or a run of literal characters
const PATH_TOKEN: RegExp = new RegExp(`:(${PARAM_NAME})|:|[^:]+`, 'g');

// A segment that mixes literal text with a param matches fewer paths than a bare param
const SEGMENT_KIND_RANK: Record<SegmentKind, number> = { literal: 0, mixed: 1, param: 2 };

function describeSegment(segment: string): SegmentKind {
  if (!segment.includes(':')) return 'literal';
  return BARE_PARAM_SEGMENT.test(segment) ? 'param' : 'mixed';
}

function describePathSegments(path: string): SegmentKind[] {
  const segments = path === '/' ? [] : path.replace(/^\//, '').split('/');
  return segments.map(describeSegment);
}

// Rank routes most specific first. Literal segments should sort above a param at the same position (compared
// left to right). This means the first position where the two disagree decides.
function compareRouteSpecificity<TAuth>(a: InternalRoute<TAuth>, b: InternalRoute<TAuth>): number {
  // Length first keeps the comparison total. Comparing only the shared prefix ranks a short path equal to two
  // longer ones that differ from each other, which Array.sort cannot place consistently
  if (a.segmentKinds.length !== b.segmentKinds.length) {
    return a.segmentKinds.length - b.segmentKinds.length;
  }

  for (const [index, aKind] of a.segmentKinds.entries()) {
    const bKind = b.segmentKinds[index];
    /* v8 ignore next -- @preserve - Guard is for TS. Both routes have the same number of segments here */
    if (bKind === undefined) continue;
    if (aKind !== bKind) {
      return SEGMENT_KIND_RANK[aKind] - SEGMENT_KIND_RANK[bKind];
    }
  }

  // A custom can only reject a request, so a route carrying one matches a subset of the same path without one
  if ((a.custom !== undefined) !== (b.custom !== undefined)) {
    return a.custom === undefined ? 1 : -1;
  }

  // Routes that agree on every compared position are equal and are kept in the same order
  return 0;
}

export class PathRouter<
  TAuth = unknown,
  TDefaultAuth extends TAuth = TAuth,
  TDefaultKind extends ResponseKind = 'json',
  TErrors = unknown,
> {
  private routes: InternalRoute<TAuth>[] = [];
  private routesSorted = false;

  // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from RouteMethodFn<this>
  route: RouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors> = (definition) => {
    const method = definition.filters.method.toUpperCase() as HttpMethod;
    // @ts-expect-error - Generic handler types narrow TPath beyond addRoute's default Record<string, string>
    return this.addRoute(method, definition);
  };

  get: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors> = this.createNoBodyRoute('GET');
  head: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors> = this.createNoBodyRoute('HEAD');
  delete: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors> = this.createNoBodyRoute('DELETE');
  options: NoBodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors> = this.createNoBodyRoute('OPTIONS');

  post: BodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors> = this.createBodyRoute('POST');
  put: BodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors> = this.createBodyRoute('PUT');
  patch: BodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors> = this.createBodyRoute('PATCH');

  private createBodyRoute(method: BodyMethod): BodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors> {
    // @ts-expect-error - Generic handler types narrow TPath beyond addRoute's default Record<string, string>
    // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from BodyRouteMethodFn return type
    return (config): this => this.addRoute(method, config);
  }

  private createNoBodyRoute(
    method: NoBodyMethod,
  ): NoBodyRouteMethodFn<this, TAuth, TDefaultAuth, TDefaultKind, TErrors> {
    // @ts-expect-error - Generic handler types narrow TPath beyond addRoute's default Record<string, string>
    // biome-ignore lint/nursery/useExplicitType: parameter type is inferred from NoBodyRouteMethodFn return type
    return (config): this => this.addRoute(method, config);
  }

  private addRoute<TPathString extends string>(
    method: HttpMethod,
    config: {
      filters: PathRouterFilters<TPathString, TAuth>;
      auth?: AuthPreset<TAuth, TAuth>;
      responseType?: ResponseTypeOption;
      handler: ApiHandler<Record<string, string>, Record<string, string | undefined>, TAuth, unknown, ResponseBody>;
      middleware?: InternalRoute<TAuth>['middleware'];
      querySchema?: StandardSchemaV1;
      bodySchema?: StandardSchemaV1;
      responseSchema?: StandardSchemaV1;
    },
  ): this {
    const { custom } = config.filters;
    const path = normalizePath(config.filters.path);
    const { pattern, pathParamNames } = this.compilePath(path);
    const segmentKinds = describePathSegments(path);

    this.routes.push({
      method,
      path,
      registrationIndex: this.routes.length,
      pattern,
      pathParamNames,
      segmentKinds,
      custom,
      handler: config.handler as InternalRoute<TAuth>['handler'],
      middleware: config.middleware ?? [],
      responseType: config.responseType,
      querySchema: config.querySchema,
      bodySchema: config.bodySchema,
      responseSchema: config.responseSchema,
      auth: config.auth,
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
    // Escape the literals so a regex metacharacter in a path (a dot in a version, a file extension, a '+')
    // matches itself. A greedy param gives any extra text to the first of two params in one segment.
    const patternStr = path.replace(PATH_TOKEN, (token, paramName?: string) => {
      if (paramName !== undefined) {
        pathParamNames.push(paramName);
        return '([^/]+)';
      }
      if (token === ':') {
        throw new Error(`Path '${path}' has a ':' without a param name`);
      }
      return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    return {
      pattern: new RegExp(`^${patternStr}$`),
      pathParamNames,
    };
  }

  // Methods come back in registration order, so the CORS preflight header does not move when ranking does
  getMethodsForPath(path: string): HttpMethod[] {
    const normalizedPath = normalizePath(path);
    const matched = this.routes
      .filter((route) => route.pattern.test(normalizedPath))
      .sort((a, b) => a.registrationIndex - b.registrationIndex);

    return [...new Set(matched.map((route) => route.method))];
  }

  async match(
    method: string,
    path: string,
    filterInput?: HTTPFilterInput<unknown, TAuth>,
  ): Promise<RouteMatch<TAuth> | null> {
    this.sortRoutes();
    const normalizedPath = normalizePath(path);
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = normalizedPath.match(route.pattern);
      if (!match) continue;

      if (route.custom && !(await route.custom(filterInput as HTTPFilterInput<unknown, TAuth>))) {
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
