import type { AppSyncAuthorizerEvent, Context } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject } from '@lambda-event-router/base';

import { isAppSyncAuthorizerResponse } from './response.js';
import type {
  AppSyncAuthorizerHandler,
  AppSyncAuthorizerMiddleware,
  AppSyncAuthorizerRequest,
  AppSyncAuthorizerResponse,
  AppSyncAuthorizerRouteBuilder,
  AppSyncAuthorizerRouteDefinition,
  AppSyncAuthorizerRouteInput,
  AppSyncAuthorizerRouterOptions,
  InternalAuthorizerRoute,
} from './types.js';

export function defineAuthorizerRoute(config?: AppSyncAuthorizerRouteInput): AppSyncAuthorizerRouteBuilder {
  return {
    handle(handler: AppSyncAuthorizerHandler): AppSyncAuthorizerRouteDefinition {
      return { filters: config?.filters, middleware: config?.middleware, handler };
    },
  };
}

export class AppSyncAuthorizerRouter implements EventTypeRouter<AppSyncAuthorizerEvent, AppSyncAuthorizerResponse> {
  private routes: InternalAuthorizerRoute[] = [];
  private middleware: AppSyncAuthorizerMiddleware[];

  constructor(options?: AppSyncAuthorizerRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is AppSyncAuthorizerEvent {
    if (!isObject(event)) return false;
    if (typeof event.authorizationToken !== 'string') return false;
    if (!isObject(event.requestContext)) return false;

    const { apiId, accountId, queryString, operationName } = event.requestContext;
    if (typeof apiId !== 'string') return false;
    if (typeof accountId !== 'string') return false;
    if (typeof queryString !== 'string') return false;

    // AppSync leaves operationName off when the client does not name the operation
    if (operationName !== undefined && typeof operationName !== 'string') return false;

    return true;
  }

  route(definition: AppSyncAuthorizerRouteDefinition): this {
    this.routes.push({
      filters: definition.filters ?? {},
      middleware: definition.middleware,
      handler: definition.handler,
    });
    return this;
  }

  async handleEvent(event: AppSyncAuthorizerEvent, context: Context): Promise<AppSyncAuthorizerResponse> {
    const { apiId, operationName } = event.requestContext;

    const route = await this.matchRoute(apiId, operationName, event);
    if (!route) {
      throw new Error(`No authorizer route matched for ${operationName ? `${operationName} on ` : ''}${apiId}`);
    }

    const request: AppSyncAuthorizerRequest = {
      authorizationToken: event.authorizationToken,
      requestHeaders: event.requestHeaders,
      apiId: event.requestContext.apiId,
      accountId: event.requestContext.accountId,
      requestId: event.requestContext.requestId,
      queryString: event.requestContext.queryString,
      operationName: event.requestContext.operationName,
      variables: event.requestContext.variables,
      event,
      context,
    };

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];

    try {
      return await handleEventWithMiddleware(allMiddleware, request, route.handler);
    } catch (error) {
      if (isAppSyncAuthorizerResponse(error)) {
        return error;
      }
      throw error;
    }
  }

  private async matchRoute(
    apiId: string,
    operationName: string | undefined,
    event: AppSyncAuthorizerEvent,
  ): Promise<InternalAuthorizerRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.apiId !== undefined && !filterStringMatcher(apiId, filters.apiId)) continue;

      // An operation name filter cannot match a request that does not name its operation.
      if (filters.operationName !== undefined) {
        if (operationName === undefined) continue;
        if (!filterStringMatcher(operationName, filters.operationName)) continue;
      }

      if (filters.custom) {
        const match = await filters.custom({ apiId, operationName, event });
        if (!match) continue;
      }

      return route;
    }
    return undefined;
  }
}

export function createAppSyncAuthorizerRouter(options?: AppSyncAuthorizerRouterOptions): AppSyncAuthorizerRouter {
  return new AppSyncAuthorizerRouter(options);
}
