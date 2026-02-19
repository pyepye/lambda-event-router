import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { CloudWatchLogsDecodedData, CloudWatchLogsEvent, CloudWatchLogsEventData, Context } from 'aws-lambda';
import { gunzipSync } from 'node:zlib';
import type {
  CloudWatchLogsControlMessageRouteDefinition,
  CloudWatchLogsDataMessageRouteDefinition,
  CloudWatchLogsFilters,
  CloudWatchLogsMessageType,
  CloudWatchLogsRequest,
  CloudWatchLogsRouteDefinition,
} from './types.js';

interface RouteBuilder {
  handle(handler: (request: CloudWatchLogsRequest) => Promise<void>): CloudWatchLogsRouteDefinition;
}

export function defineRoute(config: { filters: CloudWatchLogsFilters }): RouteBuilder {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): CloudWatchLogsRouteDefinition {
      return {
        filters: config.filters,
        handler,
      };
    },
  };
}

export class CloudWatchLogsRouter implements EventTypeRouter<CloudWatchLogsEvent, undefined> {
  private routes: CloudWatchLogsRouteDefinition[] = [];

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
      filters: { ...definition.filters, messageTypes: ['DATA_MESSAGE'] },
    });
    return this;
  }

  controlMessage(definition: CloudWatchLogsControlMessageRouteDefinition): this {
    this.routes.push({
      ...definition,
      filters: { ...definition.filters, messageTypes: ['CONTROL_MESSAGE'] },
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

    await route.handler(request);
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

      if (filters.messageTypes && !filters.messageTypes.includes(input.messageType as CloudWatchLogsMessageType)) {
        return false;
      }

      if (filters.logGroups && !filters.logGroups.includes(input.logGroup)) {
        return false;
      }

      if (filters.logGroupPrefixes) {
        const hasMatchingPrefix = filters.logGroupPrefixes.some((prefix) => input.logGroup.startsWith(prefix));
        if (!hasMatchingPrefix) return false;
      }

      if (filters.logGroupSuffixes) {
        const hasMatchingSuffix = filters.logGroupSuffixes.some((suffix) => input.logGroup.endsWith(suffix));
        if (!hasMatchingSuffix) return false;
      }

      if (filters.logGroupIncludes) {
        const hasMatchingSubstring = filters.logGroupIncludes.some((substring) => input.logGroup.includes(substring));
        if (!hasMatchingSubstring) return false;
      }

      if (filters.subscriptionFilters) {
        const routeFilters = filters.subscriptionFilters;
        const hasMatchingFilter = input.subscriptionFilters.some((subFilter) => routeFilters.includes(subFilter));
        if (!hasMatchingFilter) return false;
      }

      if (filters.customFilter) {
        return filters.customFilter(input);
      }

      return true;
    });
  }
}

export function createCloudWatchLogsRouter(): CloudWatchLogsRouter {
  return new CloudWatchLogsRouter();
}
