import { gunzipSync } from 'node:zlib';
import type { CloudWatchLogsDecodedData, CloudWatchLogsEvent, CloudWatchLogsEventData, Context } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject } from '@lambda-event-router/base';

import type {
  CloudWatchLogsControlMessageRouteDefinition,
  CloudWatchLogsDataMessageRouteDefinition,
  CloudWatchLogsFilters,
  CloudWatchLogsMessageType,
  CloudWatchLogsMiddleware,
  CloudWatchLogsRequest,
  CloudWatchLogsRouteDefinition,
  CloudWatchLogsRouterOptions,
} from './types.js';

interface RouteBuilder {
  handle(handler: (request: CloudWatchLogsRequest) => Promise<void>): CloudWatchLogsRouteDefinition;
}

export function defineRoute(config: {
  filters: CloudWatchLogsFilters;
  middleware?: CloudWatchLogsMiddleware[];
}): RouteBuilder {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): CloudWatchLogsRouteDefinition {
      return {
        filters: config.filters,
        middleware: config.middleware ?? [],
        handler,
      };
    },
  };
}

export class CloudWatchLogsRouter implements EventTypeRouter<CloudWatchLogsEvent, undefined> {
  private routes: CloudWatchLogsRouteDefinition[] = [];
  private middleware: CloudWatchLogsMiddleware[] = [];

  constructor(options?: CloudWatchLogsRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is CloudWatchLogsEvent {
    if (!isObject(event)) return false;
    if (!isObject(event.awslogs)) return false;
    return typeof event.awslogs.data === 'string';
  }

  route(definition: CloudWatchLogsRouteDefinition): this {
    this.routes.push(definition);
    return this;
  }

  dataMessage(definition: CloudWatchLogsDataMessageRouteDefinition): this {
    this.routes.push({
      ...definition,
      filters: { ...definition.filters, messageType: 'DATA_MESSAGE' },
    });
    return this;
  }

  controlMessage(definition: CloudWatchLogsControlMessageRouteDefinition): this {
    this.routes.push({
      ...definition,
      filters: { ...definition.filters, messageType: 'CONTROL_MESSAGE' },
    });
    return this;
  }

  async handleEvent(event: CloudWatchLogsEvent, context: Context): Promise<undefined> {
    const logData = this.decodeLogData(event.awslogs.data);
    const route = await this.matchRoute(logData);
    if (!route) {
      throw new Error(`No route matched for log group ${logData.logGroup}`);
    }

    const request: CloudWatchLogsRequest = {
      ...logData,
      event,
      context,
    };

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);

    return undefined;
  }

  private decodeLogData(data: CloudWatchLogsEventData['data']): CloudWatchLogsDecodedData {
    const payload = Buffer.from(data, 'base64');
    const decompressed = gunzipSync(payload);
    const decodedData: CloudWatchLogsDecodedData = JSON.parse(decompressed.toString());
    return decodedData;
  }

  private async matchRoute(input: CloudWatchLogsDecodedData): Promise<CloudWatchLogsRouteDefinition | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.messageType) {
        const messageTypes = Array.isArray(filters.messageType) ? filters.messageType : [filters.messageType];
        if (!messageTypes.includes(input.messageType as CloudWatchLogsMessageType)) continue;
      }

      if (filters.logGroup) {
        const logGroupMatch = filterStringMatcher(input.logGroup, filters.logGroup);
        if (!logGroupMatch) continue;
      }

      if (filters.subscriptionFilter) {
        const { subscriptionFilter } = filters; // Needed here due to TS having different scope for  separate function closure
        const hasMatchingFilter = input.subscriptionFilters.some((subFilter) =>
          filterStringMatcher(subFilter, subscriptionFilter),
        );
        if (!hasMatchingFilter) continue;
      }

      if (filters.customFilter) {
        const match = await filters.customFilter(input);
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createCloudWatchLogsRouter(options?: CloudWatchLogsRouterOptions): CloudWatchLogsRouter {
  return new CloudWatchLogsRouter(options);
}
