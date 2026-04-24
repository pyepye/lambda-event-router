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
  ActiveMQBytesMessageRouteDefinition,
  ActiveMQEvent,
  ActiveMQFilterInput,
  ActiveMQFilters,
  ActiveMQInternalRoute,
  ActiveMQMessage,
  ActiveMQMessageType,
  ActiveMQMiddleware,
  ActiveMQRequest,
  ActiveMQRouteBuilder,
  ActiveMQRouteDefinition,
  ActiveMQRouteInput,
  ActiveMQRouterOptions,
  ActiveMQTextMessageRouteDefinition,
} from './types.js';

export function defineActiveMQRoute<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  const TMessageType extends ActiveMQMessageType | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
>(config: ActiveMQRouteInput<TBodySchema, TMessageType>): ActiveMQRouteBuilder<TBody, TMessageType> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): ActiveMQRouteDefinition<TBody> {
      return {
        filters: config.filters as ActiveMQFilters,
        bodySchema: config.bodySchema as StandardSchemaV1<unknown, TBody> | undefined,
        middleware: config.middleware as ActiveMQRouteDefinition<TBody>['middleware'],
        handler: handler as (request: ActiveMQRequest<TBody>) => Promise<void>,
      };
    },
  };
}

export class ActiveMQRouter implements EventTypeRouter<ActiveMQEvent, undefined> {
  private routes: ActiveMQInternalRoute[] = [];
  private middleware: ActiveMQMiddleware[];

  constructor(options?: ActiveMQRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is ActiveMQEvent {
    if (!isObject(event)) return false;
    return event.eventSource === 'aws:mq' && Array.isArray(event.messages);
  }

  route<TBody>(definition: ActiveMQRouteDefinition<TBody>): this {
    this.routes.push(definition as ActiveMQInternalRoute);
    return this;
  }

  textMessage<TBody>(definition: ActiveMQTextMessageRouteDefinition<TBody>): this {
    this.routes.push({
      ...definition,
      filters: { ...definition.filters, messageType: 'jms/text-message' },
    } as ActiveMQInternalRoute);
    return this;
  }

  bytesMessage<TBody>(definition: ActiveMQBytesMessageRouteDefinition<TBody>): this {
    this.routes.push({
      ...definition,
      filters: { ...definition.filters, messageType: 'jms/bytes-message' },
    } as ActiveMQInternalRoute);
    return this;
  }

  async handleEvent(event: ActiveMQEvent, context: Context): Promise<undefined> {
    for (const message of event.messages) {
      const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
      const decodedMessage = { ...message, data: decodedData };
      const destination = message.destination.physicalName;

      const route = await this.matchRoute(event, decodedMessage);
      if (!route) {
        throw new Error(`No route matched for message ${message.messageID} from ${event.eventSourceArn}`);
      }

      const parsedBody = safeJsonParse(decodedData);
      const body = await validateSchema(
        parsedBody,
        route.bodySchema,
        `Body validation failed for message ${message.messageID}`,
      );

      const request: ActiveMQRequest = {
        message: decodedMessage,
        destination,
        body,
        messageType: message.messageType,
        record: message,
        context,
      };

      const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
      await handleEventWithMiddleware(allMiddleware, request, route.handler);
    }
  }

  private async matchRoute(event: ActiveMQEvent, message: ActiveMQMessage): Promise<ActiveMQInternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.eventSourceArn) {
        const eventSourceArnMatch = filterStringMatcher(event.eventSourceArn, filters.eventSourceArn);
        if (!eventSourceArnMatch) continue;
      }

      if (filters.messageType) {
        const messageTypes = Array.isArray(filters.messageType) ? filters.messageType : [filters.messageType];
        if (!messageTypes.includes(message.messageType)) continue;
      }

      if (filters.destination) {
        // Is calling this destination and not physicalName correct?
        const destinationMatch = filterStringMatcher(message.destination.physicalName, filters.destination);
        if (!destinationMatch) continue;
      }

      if (filters.customFilter) {
        const filterInput: ActiveMQFilterInput = {
          messageType: message.messageType,
          destination: message.destination.physicalName,
          record: message,
        };
        const match = await filters.customFilter(filterInput);
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createActiveMQRouter(options?: ActiveMQRouterOptions): ActiveMQRouter {
  return new ActiveMQRouter(options);
}
