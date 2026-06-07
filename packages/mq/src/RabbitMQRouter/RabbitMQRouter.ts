import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import {
  filterStringMatcher,
  handleEventWithMiddleware,
  isObject,
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

export function defineRabbitMQRoute<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
>(config: RabbitMQRouteInput<TBodySchema>): RabbitMQRouteBuilder<TBody> {
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

        const route = await this.matchRoute(event, queueName, virtualHost, decodedMessage, message);
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
          record: message,
          context,
        };

        const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
        await handleEventWithMiddleware(allMiddleware, request, route.handler);
      }
    }
  }

  private async matchRoute(
    event: RabbitMQEvent,
    queueName: string,
    virtualHost: string | undefined,
    message: RabbitMQMessage,
    record: RabbitMQMessage,
  ): Promise<RabbitMQInternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.eventSourceArn) {
        const eventSourceArnMatch = filterStringMatcher(event.eventSourceArn, filters.eventSourceArn);
        if (!eventSourceArnMatch) continue;
      }

      if (filters.queue) {
        const queueMatch = filterStringMatcher(queueName, filters.queue);
        if (!queueMatch) continue;
      }

      if (filters.virtualHost) {
        // A key with no "::" carries no virtual host, so a virtualHost filter cannot match it
        if (virtualHost === undefined) continue;
        const virtualHostMatch = filterStringMatcher(virtualHost, filters.virtualHost);
        if (!virtualHostMatch) continue;
      }

      if (filters.contentType) {
        // A message with no content type cannot match a contentType filter, so skip it
        const { contentType } = message.basicProperties;
        if (contentType === undefined) continue;
        const contentTypeMatch = filterStringMatcher(contentType, filters.contentType);
        if (!contentTypeMatch) continue;
      }

      if (filters.custom) {
        const filterInput: RabbitMQFilterInput = {
          queue: queueName,
          virtualHost,
          contentType: message.basicProperties.contentType,
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
