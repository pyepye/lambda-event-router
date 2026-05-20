import type { Context } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject } from '@lambda-event-router/base';

import type {
  AppSyncEventsEvent,
  AppSyncEventsMiddleware,
  AppSyncEventsRequest,
  AppSyncEventsRouteBuilder,
  AppSyncEventsRouteDefinition,
  AppSyncEventsRouteInput,
  AppSyncEventsRouterOptions,
  AppSyncPublishInput,
  AppSyncSubscribeInput,
  InternalEventsRoute,
} from './types.js';

export function defineEventsRoute(config: AppSyncEventsRouteInput): AppSyncEventsRouteBuilder {
  return {
    handle(handler: (request: AppSyncEventsRequest) => Promise<unknown>): AppSyncEventsRouteDefinition {
      return {
        filters: config.filters ?? {},
        middleware: config.middleware,
        handler,
      };
    },
  };
}

export class AppSyncEventsRouter implements EventTypeRouter<AppSyncEventsEvent, unknown> {
  private routes: InternalEventsRoute[] = [];
  private middleware: AppSyncEventsMiddleware[];

  constructor(options?: AppSyncEventsRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is AppSyncEventsEvent {
    if (!isObject(event)) return false;

    const info = event.info;
    if (!isObject(info)) return false;

    if (!isObject(info.channel)) return false;
    if (!isObject(info.channelNamespace)) return false;
    if (typeof info.operation !== 'string') return false;

    return true;
  }

  route(definition: AppSyncEventsRouteDefinition): this {
    this.routes.push(definition);
    return this;
  }

  publish(input: AppSyncPublishInput): this {
    return this.route({
      filters: {
        ...input.filters,
        operation: 'PUBLISH',
        channelNamespace: input.channelNamespace,
      },
      middleware: input.middleware,
      handler: input.handler,
    });
  }

  subscribe(input: AppSyncSubscribeInput): this {
    return this.route({
      filters: {
        ...input.filters,
        operation: 'SUBSCRIBE',
        channelNamespace: input.channelNamespace,
      },
      middleware: input.middleware,
      handler: input.handler,
    });
  }

  async handleEvent(event: AppSyncEventsEvent, context: Context): Promise<unknown> {
    const { operation } = event.info;
    const channelPath = event.info.channel.path;
    const channelNamespace = event.info.channelNamespace.name;

    const route = await this.matchRoute(operation, channelPath, channelNamespace, event);
    if (!route) {
      throw new Error(`No route matched for ${operation} on channel ${channelPath}`);
    }

    const request: AppSyncEventsRequest = {
      channel: channelPath,
      channelNamespace,
      operation,
      identity: event.identity,
      events: event.events ?? [],
      info: event.info,
      request: event.request,
      stash: event.stash,
      prev: event.prev,
      event,
      context,
    };

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    return handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(
    operation: string,
    channelPath: string,
    channelNamespace: string,
    event: AppSyncEventsEvent,
  ): Promise<InternalEventsRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      const operationTyped = operation as AppSyncEventsEvent['info']['operation'];

      if (filters.operation) {
        const operations = Array.isArray(filters.operation) ? filters.operation : [filters.operation];
        if (!operations.includes(operationTyped)) {
          continue;
        }
      }

      if (filters.channelNamespace) {
        const channelNamespaceMatch = filterStringMatcher(channelPath, filters.channelNamespace);
        if (!channelNamespaceMatch) continue;
      }

      if (filters.custom) {
        const match = await filters.custom({
          operation: operationTyped,
          channelNamespace,
          channel: channelPath,
          event,
        });
        if (!match) continue;
      }
      return route;
    }
    return undefined;
  }
}

export function createAppSyncEventsRouter(options?: AppSyncEventsRouterOptions): AppSyncEventsRouter {
  return new AppSyncEventsRouter(options);
}
