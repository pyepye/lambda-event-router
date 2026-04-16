import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type { AppSyncEventsEvent } from './appSyncEventsTypes.js';
import type {
  AppSyncEventsRequest,
  AppSyncEventsRouteBuilder,
  AppSyncEventsRouteDefinition,
  AppSyncEventsRouteInput,
  AppSyncPublishInput,
  AppSyncSubscribeInput,
  InternalEventsRoute,
} from './types.js';

export function defineEventsRoute(config: AppSyncEventsRouteInput): AppSyncEventsRouteBuilder {
  return {
    handle(handler: (request: AppSyncEventsRequest) => Promise<unknown>): AppSyncEventsRouteDefinition {
      return {
        filters: config.filters ?? {},
        handler,
      };
    },
  };
}

export class AppSyncEventsRouter implements EventTypeRouter<AppSyncEventsEvent, unknown> {
  private routes: InternalEventsRoute[] = [];

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
      handler: input.handler,
    });
  }

  async handleEvent(event: AppSyncEventsEvent, context: Context): Promise<unknown> {
    const { operation } = event.info;
    const channelPath = event.info.channel.path;
    const channelNamespace = event.info.channelNamespace.name;

    const route = this.matchRoute(operation, channelPath, channelNamespace, event);
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

    return route.handler(request);
  }

  private matchRoute(
    operation: string,
    channelPath: string,
    channelNamespace: string,
    event: AppSyncEventsEvent,
  ): InternalEventsRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      const operationTyped = operation as AppSyncEventsEvent['info']['operation'];

      if (filters.operation) {
        const operations = Array.isArray(filters.operation) ? filters.operation : [filters.operation];
        if (!operations.includes(operationTyped)) {
          return false;
        }
      }

      if (filters.channelNamespace) {
        const { channelNamespace: filterNamespace } = filters;
        const channelNamespaces = Array.isArray(filterNamespace) ? filterNamespace : [filterNamespace];
        const matchesNamespace = channelNamespaces.some((pattern) =>
          matchChannelNamespace(pattern, channelPath, channelNamespace),
        );
        if (!matchesNamespace) return false;
      }

      if (filters.customFilter) {
        return filters.customFilter({
          operation: operationTyped,
          channelNamespace,
          channel: channelPath,
          event,
        });
      }

      return true;
    });
  }
}

// Matches a channel namespace pattern against a channel path
// "/*" matches everything, "/foo/*" matches paths starting with "/foo", otherwise exact match
function matchChannelNamespace(pattern: string, channelPath: string, channelNamespace: string): boolean {
  if (pattern === '/*') return true;

  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    // Strip leading slash from prefix for namespace comparison: /default -> default
    return channelPath.startsWith(prefix) || channelNamespace === prefix.replace(/^\//, '');
  }

  return channelPath === pattern || channelNamespace === pattern || `/${channelNamespace}` === pattern;
}

export function createAppSyncEventsRouter(): AppSyncEventsRouter {
  return new AppSyncEventsRouter();
}
