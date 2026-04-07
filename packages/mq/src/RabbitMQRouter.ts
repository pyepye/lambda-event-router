import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, safeJsonParse, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from 'aws-lambda';
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
} from './rabbitMQTypes.js';

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
      // Queue key format is "queueName::virtualHost" - split and take name before separator
      const separatorIndex = queueKey.indexOf('::');
      const queueName = separatorIndex >= 0 ? queueKey.substring(0, separatorIndex) : queueKey;

      for (const message of messages) {
        const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
        const decodedMessage = { ...message, data: decodedData };

        const route = this.matchRoute(event, queueName, decodedMessage);
        if (!route) {
          throw new Error(`No route matched for message on queue ${queueName} from ${event.eventSourceArn}`);
        }

        const parsedBody = safeJsonParse(decodedData);
        const body = await validateSchema(parsedBody, route.bodySchema, 'Body validation failed');

        const request: RabbitMQRequest = {
          message: decodedMessage,
          queue: queueName,
          body,
          record: message,
          context,
        };

        const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
        await handleEventWithMiddleware(allMiddleware, request, route.handler);
      }
    }
  }

  private matchRoute(
    event: RabbitMQEvent,
    queueName: string,
    message: RabbitMQMessage,
  ): RabbitMQInternalRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.eventSourceArns && !filters.eventSourceArns.includes(event.eventSourceArn)) {
        return false;
      }

      if (filters.queues && !filters.queues.includes(queueName)) {
        return false;
      }

      if (filters.contentTypes && !filters.contentTypes.includes(message.basicProperties.contentType)) {
        return false;
      }

      if (filters.customFilter) {
        const filterInput: RabbitMQFilterInput = {
          queue: queueName,
          contentType: message.basicProperties.contentType,
          record: message,
        };
        return filters.customFilter(filterInput);
      }

      return true;
    });
  }
}

export function createRabbitMQRouter(options?: RabbitMQRouterOptions): RabbitMQRouter {
  return new RabbitMQRouter(options);
}
