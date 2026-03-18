import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type {
  RabbitMQEvent,
  RabbitMQFilterInput,
  RabbitMQFilters,
  RabbitMQInternalRoute,
  RabbitMQMessage,
  RabbitMQRequest,
  RabbitMQRouteBuilder,
  RabbitMQRouteDefinition,
  RabbitMQRouteInput,
} from './rabbitMQTypes.js';

export function defineRabbitMQRoute<
  TBodySchema extends Schema<unknown> | undefined = undefined,
  TBody = TBodySchema extends Schema<unknown> ? InferSchema<TBodySchema> : unknown,
>(config: RabbitMQRouteInput<TBodySchema>): RabbitMQRouteBuilder<TBody> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): RabbitMQRouteDefinition<TBody> {
      return {
        filters: config.filters as RabbitMQFilters,
        bodySchema: config.bodySchema as Schema<TBody> | undefined,
        handler: handler as (request: RabbitMQRequest<TBody>) => Promise<void>,
      };
    },
  };
}

export class RabbitMQRouter implements EventTypeRouter<RabbitMQEvent, undefined> {
  private routes: RabbitMQInternalRoute[] = [];

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

        const parsedBody = this.parseJsonBody(decodedData);
        const body = this.validateBody(parsedBody, route.bodySchema, queueName);

        const request: RabbitMQRequest = {
          message: decodedMessage,
          queue: queueName,
          body,
          record: message,
          context,
        };

        await route.handler(request);
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

  private parseJsonBody(data: string): unknown {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  private validateBody(body: unknown, schema: Schema<unknown> | undefined, queueName: string): unknown {
    if (!schema) {
      return body;
    }

    if (typeof body === 'string') {
      throw new Error(`Failed to parse JSON body for message on queue ${queueName}`);
    }

    const result = schema.safeParse(body);
    if (!result.success) {
      throw new Error(`Body validation failed for message on queue ${queueName}`);
    }
    return result.data;
  }
}

export function createRabbitMQRouter(): RabbitMQRouter {
  return new RabbitMQRouter();
}
