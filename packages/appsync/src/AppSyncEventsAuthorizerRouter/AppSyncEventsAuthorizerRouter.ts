import type { Context } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import {
  filterStringMatcher,
  handleEventWithMiddleware,
  isObject,
  orderRoutesBySpecificity,
} from '@lambda-event-router/base';

import { isAppSyncEventsAuthorizerResponse } from './response.js';
import type {
  AppSyncEventsAuthorizerChannelInput,
  AppSyncEventsAuthorizerConnectInput,
  AppSyncEventsAuthorizerEvent,
  AppSyncEventsAuthorizerFilters,
  AppSyncEventsAuthorizerHandler,
  AppSyncEventsAuthorizerMiddleware,
  AppSyncEventsAuthorizerOperation,
  AppSyncEventsAuthorizerRequest,
  AppSyncEventsAuthorizerResponse,
  AppSyncEventsAuthorizerRouteBuilder,
  AppSyncEventsAuthorizerRouteDefinition,
  AppSyncEventsAuthorizerRouteInput,
  AppSyncEventsAuthorizerRouterOptions,
  InferAuthorizerRequest,
  InternalEventsAuthorizerRoute,
} from './types.js';

const OPERATIONS: AppSyncEventsAuthorizerOperation[] = ['EVENT_CONNECT', 'EVENT_PUBLISH', 'EVENT_SUBSCRIBE'];

function isAuthorizerOperation(value: unknown): value is AppSyncEventsAuthorizerOperation {
  return typeof value === 'string' && OPERATIONS.includes(value as AppSyncEventsAuthorizerOperation);
}

export function defineEventsAuthorizerRoute<TOperation extends AppSyncEventsAuthorizerFilters['operation'] = undefined>(
  config?: AppSyncEventsAuthorizerRouteInput<TOperation>,
): AppSyncEventsAuthorizerRouteBuilder<InferAuthorizerRequest<TOperation>> {
  return {
    handle(
      handler: AppSyncEventsAuthorizerHandler<InferAuthorizerRequest<TOperation>>,
    ): AppSyncEventsAuthorizerRouteDefinition {
      return {
        filters: config?.filters as AppSyncEventsAuthorizerFilters | undefined,
        middleware: config?.middleware as AppSyncEventsAuthorizerMiddleware[] | undefined,
        handler: handler as AppSyncEventsAuthorizerHandler,
      };
    },
  };
}

export class AppSyncEventsAuthorizerRouter
  implements EventTypeRouter<AppSyncEventsAuthorizerEvent, AppSyncEventsAuthorizerResponse>
{
  private routes: InternalEventsAuthorizerRoute[] = [];
  private routesOrdered = false;
  private middleware: AppSyncEventsAuthorizerMiddleware[];

  constructor(options?: AppSyncEventsAuthorizerRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is AppSyncEventsAuthorizerEvent {
    if (!isObject(event)) return false;
    if (typeof event.authorizationToken !== 'string') return false;
    if (!isObject(event.requestContext)) return false;

    const { apiId, accountId, operation, channel, channelNamespaceName } = event.requestContext;
    if (typeof apiId !== 'string') return false;
    if (typeof accountId !== 'string') return false;
    if (!isAuthorizerOperation(operation)) return false;

    // An EVENT_CONNECT names no channel, so both keys are absent rather than empty.
    if (channel !== undefined && typeof channel !== 'string') return false;
    if (channelNamespaceName !== undefined && typeof channelNamespaceName !== 'string') return false;

    return true;
  }

  route(definition: AppSyncEventsAuthorizerRouteDefinition): this {
    this.routes.push({
      filters: definition.filters ?? {},
      middleware: definition.middleware,
      handler: definition.handler,
    });
    this.routesOrdered = false;
    return this;
  }

  connect(input: AppSyncEventsAuthorizerConnectInput): this {
    return this.route({
      filters: { ...input.filters, operation: 'EVENT_CONNECT' },
      middleware: input.middleware as AppSyncEventsAuthorizerMiddleware[] | undefined,
      handler: input.handler as AppSyncEventsAuthorizerHandler,
    });
  }

  publish(input: AppSyncEventsAuthorizerChannelInput): this {
    return this.route({
      filters: { ...input.filters, operation: 'EVENT_PUBLISH', channelPath: input.channelPath },
      middleware: input.middleware as AppSyncEventsAuthorizerMiddleware[] | undefined,
      handler: input.handler as AppSyncEventsAuthorizerHandler,
    });
  }

  subscribe(input: AppSyncEventsAuthorizerChannelInput): this {
    return this.route({
      filters: { ...input.filters, operation: 'EVENT_SUBSCRIBE', channelPath: input.channelPath },
      middleware: input.middleware as AppSyncEventsAuthorizerMiddleware[] | undefined,
      handler: input.handler as AppSyncEventsAuthorizerHandler,
    });
  }

  async handleEvent(event: AppSyncEventsAuthorizerEvent, context: Context): Promise<AppSyncEventsAuthorizerResponse> {
    const { operation, channel, channelNamespaceName } = event.requestContext;

    const route = await this.matchRoute(operation, channel, channelNamespaceName, event);
    if (!route) {
      throw new Error(`No authorizer route matched for ${operation}${channel ? ` on channel ${channel}` : ''}`);
    }

    const request: AppSyncEventsAuthorizerRequest = {
      authorizationToken: event.authorizationToken,
      requestHeaders: event.requestHeaders,
      apiId: event.requestContext.apiId,
      accountId: event.requestContext.accountId,
      requestId: event.requestContext.requestId,
      operation,
      ...(channel !== undefined && { channelPath: channel }),
      ...(channelNamespaceName !== undefined && { channelNamespace: channelNamespaceName }),
      event,
      context,
    };

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];

    try {
      return await handleEventWithMiddleware(allMiddleware, request, route.handler);
    } catch (error) {
      if (isAppSyncEventsAuthorizerResponse(error)) {
        return error;
      }
      throw error;
    }
  }

  private orderRoutes(): void {
    if (this.routesOrdered) return;

    this.routes = orderRoutesBySpecificity(this.routes);
    this.routesOrdered = true;
  }

  private async matchRoute(
    operation: AppSyncEventsAuthorizerOperation,
    channelPath: string | undefined,
    channelNamespace: string | undefined,
    event: AppSyncEventsAuthorizerEvent,
  ): Promise<InternalEventsAuthorizerRoute | undefined> {
    this.orderRoutes();

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.operation !== undefined) {
        const operations = Array.isArray(filters.operation) ? filters.operation : [filters.operation];
        if (!operations.includes(operation)) continue;
      }

      // A channel filter cannot match a connect, which names no channel.
      if (filters.channelPath !== undefined) {
        if (channelPath === undefined) continue;
        if (!filterStringMatcher(channelPath, filters.channelPath)) continue;
      }

      if (filters.channelNamespace !== undefined) {
        if (channelNamespace === undefined) continue;
        if (!filterStringMatcher(channelNamespace, filters.channelNamespace)) continue;
      }

      if (filters.custom) {
        const match = await filters.custom({ operation, channelPath, channelNamespace, event });
        if (!match) continue;
      }

      return route;
    }
    return undefined;
  }
}

export function createAppSyncEventsAuthorizerRouter(
  options?: AppSyncEventsAuthorizerRouterOptions,
): AppSyncEventsAuthorizerRouter {
  return new AppSyncEventsAuthorizerRouter(options);
}
