import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, safeJsonParse, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from 'aws-lambda';
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
} from './activeMQTypes.js';

export function defineActiveMQRoute<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  const TMessageTypes extends readonly ActiveMQMessageType[] | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
>(config: ActiveMQRouteInput<TBodySchema, TMessageTypes>): ActiveMQRouteBuilder<TBody, TMessageTypes> {
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
      filters: { ...definition.filters, messageTypes: ['jms/text-message'] },
    } as ActiveMQInternalRoute);
    return this;
  }

  bytesMessage<TBody>(definition: ActiveMQBytesMessageRouteDefinition<TBody>): this {
    this.routes.push({
      ...definition,
      filters: { ...definition.filters, messageTypes: ['jms/bytes-message'] },
    } as ActiveMQInternalRoute);
    return this;
  }

  async handleEvent(event: ActiveMQEvent, context: Context): Promise<undefined> {
    for (const message of event.messages) {
      const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
      const decodedMessage = { ...message, data: decodedData };
      const destination = message.destination.physicalName;

      const route = this.matchRoute(event, decodedMessage);
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

  private matchRoute(event: ActiveMQEvent, message: ActiveMQMessage): ActiveMQInternalRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.eventSourceArns && !filters.eventSourceArns.includes(event.eventSourceArn)) {
        return false;
      }

      if (filters.messageTypes && !filters.messageTypes.includes(message.messageType)) {
        return false;
      }

      if (filters.destinations && !filters.destinations.includes(message.destination.physicalName)) {
        return false;
      }

      if (filters.customFilter) {
        const filterInput: ActiveMQFilterInput = {
          messageType: message.messageType,
          destination: message.destination.physicalName,
          record: message,
        };
        return filters.customFilter(filterInput);
      }

      return true;
    });
  }
}

export function createActiveMQRouter(options?: ActiveMQRouterOptions): ActiveMQRouter {
  return new ActiveMQRouter(options);
}
