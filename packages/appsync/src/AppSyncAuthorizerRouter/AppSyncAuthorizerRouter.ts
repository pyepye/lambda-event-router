import type { AppSyncAuthorizerEvent, Context } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject } from '@lambda-event-router/base';

import { isAppSyncAuthorizerResponse } from './response.js';
import type {
  AppSyncAuthorizerMiddleware,
  AppSyncAuthorizerRequest,
  AppSyncAuthorizerResponse,
  AppSyncAuthorizerRouteBuilder,
  AppSyncAuthorizerRouteDefinition,
  AppSyncAuthorizerRouteInput,
  AppSyncAuthorizerRouterOptions,
} from './types.js';

export function defineAuthorizerRoute(config?: AppSyncAuthorizerRouteInput): AppSyncAuthorizerRouteBuilder {
  return {
    handle(
      handler: (request: AppSyncAuthorizerRequest) => Promise<AppSyncAuthorizerResponse>,
    ): AppSyncAuthorizerRouteDefinition {
      return { middleware: config?.middleware, handler };
    },
  };
}

export class AppSyncAuthorizerRouter implements EventTypeRouter<AppSyncAuthorizerEvent, AppSyncAuthorizerResponse> {
  private routeDefinition: AppSyncAuthorizerRouteDefinition | undefined;
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
    this.routeDefinition = definition;
    return this;
  }

  async handleEvent(event: AppSyncAuthorizerEvent, context: Context): Promise<AppSyncAuthorizerResponse> {
    if (!this.routeDefinition) {
      throw new Error('No authorizer route registered');
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

    const allMiddleware = [...this.middleware, ...(this.routeDefinition.middleware ?? [])];

    try {
      return await handleEventWithMiddleware(allMiddleware, request, this.routeDefinition.handler);
    } catch (error) {
      if (isAppSyncAuthorizerResponse(error)) {
        return error;
      }
      throw error;
    }
  }
}

export function createAppSyncAuthorizerRouter(options?: AppSyncAuthorizerRouterOptions): AppSyncAuthorizerRouter {
  return new AppSyncAuthorizerRouter(options);
}
