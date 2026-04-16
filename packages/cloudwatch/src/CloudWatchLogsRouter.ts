import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject } from '@lambda-event-router/base';
import type { CloudWatchLogsDecodedData, CloudWatchLogsEvent, CloudWatchLogsEventData, Context } from 'aws-lambda';
import { gunzipSync } from 'node:zlib';
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
    const route = this.matchRoute(logData);
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

  private matchRoute(input: CloudWatchLogsDecodedData): CloudWatchLogsRouteDefinition | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.messageType) {
        const messageTypes = Array.isArray(filters.messageType) ? filters.messageType : [filters.messageType];
        if (!messageTypes.includes(input.messageType as CloudWatchLogsMessageType)) return false;
      }

      if (filters.logGroup) {
        const logGroups = Array.isArray(filters.logGroup) ? filters.logGroup : [filters.logGroup];
        if (!logGroups.includes(input.logGroup)) return false;
      }

      if (filters.logGroupPrefix) {
        const prefixes = Array.isArray(filters.logGroupPrefix) ? filters.logGroupPrefix : [filters.logGroupPrefix];
        const hasMatchingPrefix = prefixes.some((prefix) => input.logGroup.startsWith(prefix));
        if (!hasMatchingPrefix) return false;
      }

      if (filters.logGroupSuffix) {
        const suffixes = Array.isArray(filters.logGroupSuffix) ? filters.logGroupSuffix : [filters.logGroupSuffix];
        const hasMatchingSuffix = suffixes.some((suffix) => input.logGroup.endsWith(suffix));
        if (!hasMatchingSuffix) return false;
      }

      if (filters.logGroupIncludes) {
        const { logGroupIncludes: filterIncludes } = filters;
        const includes = Array.isArray(filterIncludes) ? filterIncludes : [filterIncludes];
        const hasMatchingSubstring = includes.some((substring) => input.logGroup.includes(substring));
        if (!hasMatchingSubstring) return false;
      }

      if (filters.subscriptionFilter) {
        const { subscriptionFilter } = filters;
        const subFilters = Array.isArray(subscriptionFilter) ? subscriptionFilter : [subscriptionFilter];
        const hasMatchingFilter = input.subscriptionFilters.some((subFilter) => subFilters.includes(subFilter));
        if (!hasMatchingFilter) return false;
      }

      if (filters.customFilter) {
        return filters.customFilter(input);
      }

      return true;
    });
  }
}

export function createCloudWatchLogsRouter(options?: CloudWatchLogsRouterOptions): CloudWatchLogsRouter {
  return new CloudWatchLogsRouter(options);
}
