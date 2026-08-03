import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import {
  filterStringMatcher,
  handleEventWithMiddleware,
  isObject,
  orderRoutesBySpecificity,
  safeJsonParse,
  validateSchema,
} from '@lambda-event-router/base';

import type {
  RabbitMQEvent,
  RabbitMQFilterInput,
  RabbitMQFilters,
  RabbitMQInternalRoute,
  RabbitMQMessage,
  RabbitMQMiddleware,
  RabbitMQRequest,
  RabbitMQRouteBuilder,
  RabbitMQRouteDefinition,
  RabbitMQRouteInput,
  RabbitMQRouterOptions,
} from './types.js';

const MONTH_INDEXES: Map<string, number> = new Map([
  ['Jan', 0],
  ['Feb', 1],
  ['Mar', 2],
  ['Apr', 3],
  ['May', 4],
  ['Jun', 5],
  ['Jul', 6],
  ['Aug', 7],
  ['Sep', 8],
  ['Oct', 9],
  ['Nov', 10],
  ['Dec', 11],
]);

const HOURS_PER_MERIDIEM: number = 12;

// Amazon MQ sends the AMQP timestamp as Java locale text in UTC, such as "Sep 21, 2026, 2:13:20 PM".
// Groups: month, day, year, hour, minute, second, AM or PM. The space before the meridiem can be a
// normal space or a narrow no-break space (U+202F).
const TIMESTAMP_PATTERN: RegExp = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}):(\d{2})[ \u202F](AM|PM)$/;

export function defineRabbitMQRoute<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
>(config: RabbitMQRouteInput<TBodySchema, TBody>): RabbitMQRouteBuilder<TBody> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): RabbitMQRouteDefinition<TBody> {
      return {
        filters: config.filters as RabbitMQFilters,
        bodySchema: config.bodySchema as StandardSchemaV1<unknown, TBody> | undefined,
        middleware: config.middleware as RabbitMQRouteDefinition<TBody>['middleware'],
        handler: handler as (request: RabbitMQRequest<TBody>) => Promise<void>,
      };
    },
  };
}

export class RabbitMQRouter implements EventTypeRouter<RabbitMQEvent, undefined> {
  private routes: RabbitMQInternalRoute[] = [];
  private routesOrdered = false;
  private middleware: RabbitMQMiddleware[];

  constructor(options?: RabbitMQRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is RabbitMQEvent {
    if (!isObject(event)) return false;
    return event.eventSource === 'aws:rmq' && isObject(event.rmqMessagesByQueue);
  }

  route<TBody>(definition: RabbitMQRouteDefinition<TBody>): this {
    this.routes.push(definition as RabbitMQInternalRoute);
    this.routesOrdered = false;
    return this;
  }

  async handleEvent(event: RabbitMQEvent, context: Context): Promise<undefined> {
    const queueEntries = Object.entries(event.rmqMessagesByQueue);

    for (const [queueKey, messages] of queueEntries) {
      // Queue key format is "queueName::virtualHost" - split into the name and the virtual host
      const separatorIndex = queueKey.indexOf('::');
      const queueName = separatorIndex >= 0 ? queueKey.substring(0, separatorIndex) : queueKey;
      const virtualHost = separatorIndex >= 0 ? queueKey.substring(separatorIndex + 2) : undefined;

      for (const message of messages) {
        const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
        const decodedMessage = { ...message, data: decodedData };

        const timestamp = this.parseTimestamp(message.basicProperties.timestamp);

        const route = await this.matchRoute(event, queueName, virtualHost, decodedMessage, message, timestamp);
        if (!route) {
          throw new Error(`No route matched for message on queue ${queueName} from ${event.eventSourceArn}`);
        }

        const parsedBody = safeJsonParse(decodedData);
        const body = await validateSchema(parsedBody, route.bodySchema, 'Body validation failed');

        const request: RabbitMQRequest = {
          message: decodedMessage,
          queue: queueName,
          virtualHost,
          body,
          timestamp,
          record: message,
          context,
        };

        const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
        await handleEventWithMiddleware(allMiddleware, request, route.handler);
      }
    }
  }

  private parseTimestamp(timestamp: string | null): Date | null {
    if (timestamp === null) return null;

    const match = TIMESTAMP_PATTERN.exec(timestamp);
    if (!match) return null;

    const [, monthName = '', day, year, hour, minute, second, meridiem] = match;
    const monthIndex = MONTH_INDEXES.get(monthName);
    if (monthIndex === undefined) return null;

    const hourOnClock = Number(hour) % HOURS_PER_MERIDIEM;
    const hourOfDay = meridiem === 'PM' ? hourOnClock + HOURS_PER_MERIDIEM : hourOnClock;
    const milliseconds = Date.UTC(Number(year), monthIndex, Number(day), hourOfDay, Number(minute), Number(second));

    return new Date(milliseconds);
  }

  private orderRoutes(): void {
    if (this.routesOrdered) return;

    this.routes = orderRoutesBySpecificity(this.routes);
    this.routesOrdered = true;
  }

  private async matchRoute(
    event: RabbitMQEvent,
    queueName: string,
    virtualHost: string | undefined,
    message: RabbitMQMessage,
    record: RabbitMQMessage,
    timestamp: Date | null,
  ): Promise<RabbitMQInternalRoute | undefined> {
    this.orderRoutes();

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.eventSourceArn !== undefined) {
        const eventSourceArnMatch = filterStringMatcher(event.eventSourceArn, filters.eventSourceArn);
        if (!eventSourceArnMatch) continue;
      }

      if (filters.queue !== undefined) {
        const queueMatch = filterStringMatcher(queueName, filters.queue);
        if (!queueMatch) continue;
      }

      if (filters.virtualHost !== undefined) {
        // A key with no "::" carries no virtual host, so a virtualHost filter cannot match it
        if (virtualHost === undefined) continue;
        const virtualHostMatch = filterStringMatcher(virtualHost, filters.virtualHost);
        if (!virtualHostMatch) continue;
      }

      if (filters.contentType !== undefined) {
        // A message with no content type cannot match a contentType filter, so skip it
        const { contentType } = message.basicProperties;
        if (contentType === null) continue;
        const contentTypeMatch = filterStringMatcher(contentType, filters.contentType);
        if (!contentTypeMatch) continue;
      }

      if (filters.custom) {
        const filterInput: RabbitMQFilterInput = {
          queue: queueName,
          virtualHost,
          contentType: message.basicProperties.contentType,
          timestamp,
          message,
          record,
        };
        const matches = await filters.custom(filterInput);
        if (!matches) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createRabbitMQRouter(options?: RabbitMQRouterOptions): RabbitMQRouter {
  return new RabbitMQRouter(options);
}
