import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type {
  EventBridgeEventEnvelope,
  EventBridgeFilterInput,
  EventBridgeHandler,
  EventBridgeRequest,
  EventBridgeRouteDefinition,
  LookupDetailType,
} from './types.js';

interface InternalEventBridgeRoute {
  filters: EventBridgeRouteDefinition['filters'];
  detailSchema?: Schema<unknown>;
  handler: EventBridgeHandler<unknown>;
}

interface EventBridgeRouteInput<
  TDetailSchema extends Schema<unknown> | undefined = undefined,
  TSources extends readonly string[] | undefined = undefined,
  TDetailTypes extends readonly string[] | undefined = undefined,
> {
  filters: {
    sources?: TSources;
    detailTypes?: TDetailTypes;
    accounts?: string[];
    regions?: string[];
    resources?: string[];
    customFilter?: (input: EventBridgeFilterInput) => boolean;
  };
  detailSchema?: TDetailSchema;
}

interface EventBridgeRouteBuilder<TDetail> {
  handle(handler: EventBridgeHandler<TDetail>): EventBridgeRouteDefinition<TDetail>;
}

export function defineRoute<
  TDetailSchema extends Schema<unknown> | undefined = undefined,
  const TSources extends readonly string[] | undefined = undefined,
  const TDetailTypes extends readonly string[] | undefined = undefined,
  TDetail = TDetailSchema extends Schema<unknown>
    ? InferSchema<TDetailSchema>
    : LookupDetailType<TSources, TDetailTypes>,
>(config: EventBridgeRouteInput<TDetailSchema, TSources, TDetailTypes>): EventBridgeRouteBuilder<TDetail> {
  return {
    handle(handler: EventBridgeHandler<TDetail>): EventBridgeRouteDefinition<TDetail> {
      // Cast needed: generic type narrowing from builder input to route definition
      const filters = config.filters as EventBridgeRouteDefinition<TDetail>['filters'];
      const detailSchema = config.detailSchema as EventBridgeRouteDefinition<TDetail>['detailSchema'];
      return { filters, detailSchema, handler };
    },
  };
}

export class EventBridgeRouter implements EventTypeRouter<EventBridgeEventEnvelope, void> {
  private routes: InternalEventBridgeRoute[] = [];

  canHandleEvent(event: unknown): event is EventBridgeEventEnvelope {
    if (!isObject(event)) return false;
    if (typeof event.source !== 'string') return false;
    /* v8 ignore next -- @preserve - Guard is for TS. EventBridge always provides source, detail-type, and detail together - checked individually for type narrowing */
    if (typeof event['detail-type'] !== 'string') return false;
    /* v8 ignore next -- @preserve - Guard is for TS. EventBridge always provides detail as an object - checked individually for type narrowing */
    if (!isObject(event.detail)) return false;
    return true;
  }

  route<TDetail>(definition: EventBridgeRouteDefinition<TDetail>): this {
    // Cast needed: storing specific handler type in general storage (contravariance)
    const handler = definition.handler as EventBridgeHandler<unknown>;
    this.routes.push({
      filters: definition.filters,
      detailSchema: definition.detailSchema,
      handler,
    });
    return this;
  }

  async handleEvent(event: EventBridgeEventEnvelope, context: Context): Promise<void> {
    const route = this.matchRoute(event);
    if (!route) {
      throw new Error(`No route matched for EventBridge event: ${event.source} / ${event['detail-type']}`);
    }

    const detail = this.validateSchema(
      event.detail,
      route.detailSchema,
      `Detail validation failed for event ${event.id}`,
    );

    const request: EventBridgeRequest = {
      source: event.source,
      detailType: event['detail-type'],
      detail,
      account: event.account,
      region: event.region,
      time: event.time,
      resources: event.resources,
      id: event.id,
      event,
      context,
    };

    await route.handler(request);
  }

  private matchRoute(event: EventBridgeEventEnvelope): InternalEventBridgeRoute | undefined {
    const filterInput: EventBridgeFilterInput = {
      event,
      source: event.source,
      detailType: event['detail-type'],
      detail: event.detail,
    };

    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.sources && !filters.sources.includes(event.source)) {
        return false;
      }
      if (filters.detailTypes && !filters.detailTypes.includes(event['detail-type'])) {
        return false;
      }
      if (filters.accounts && !filters.accounts.includes(event.account)) {
        return false;
      }
      if (filters.regions && !filters.regions.includes(event.region)) {
        return false;
      }
      if (filters.resources) {
        const hasMatchingResource = event.resources.some((r) => filters.resources?.includes(r));
        if (!hasMatchingResource) {
          return false;
        }
      }

      if (filters.customFilter) {
        return filters.customFilter(filterInput);
      }

      return true;
    });
  }

  private validateSchema(data: unknown, schema: Schema<unknown> | undefined, errorContext: string): unknown {
    if (!schema) {
      return data;
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`${errorContext}: ${result.error}`);
    }
    return result.data;
  }
}

export function createEventBridgeRouter(): EventBridgeRouter {
  return new EventBridgeRouter();
}
