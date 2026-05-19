import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject, validateSchema } from '@lambda-event-router/base';

import type {
  EventBridgeEventEnvelope,
  EventBridgeFilterInput,
  EventBridgeFilters,
  EventBridgeHandler,
  EventBridgeMiddleware,
  EventBridgeRequest,
  EventBridgeRouteDefinition,
  EventBridgeRouterOptions,
  LookupDetailType,
} from './types.js';

interface InternalEventBridgeRoute {
  filters: EventBridgeFilters;
  detailSchema?: StandardSchemaV1;
  middleware?: EventBridgeMiddleware[];
  handler: EventBridgeHandler<unknown>;
}

interface EventBridgeRouteInput<
  TDetailSchema extends StandardSchemaV1 | undefined = undefined,
  TSources extends string | readonly string[] | undefined = undefined,
  TDetailTypes extends string | readonly string[] | undefined = undefined,
> {
  filters: Omit<EventBridgeFilters, 'source' | 'detailType'> & {
    source?: TSources;
    detailType?: TDetailTypes;
  };
  detailSchema?: TDetailSchema;
  middleware?: EventBridgeMiddleware[];
}

interface EventBridgeRouteBuilder<TDetail> {
  handle(handler: EventBridgeHandler<TDetail>): EventBridgeRouteDefinition<TDetail>;
}

export function defineRoute<
  TDetailSchema extends StandardSchemaV1 | undefined = undefined,
  const TSources extends string | readonly string[] | undefined = undefined,
  const TDetailTypes extends string | readonly string[] | undefined = undefined,
  TDetail = TDetailSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TDetailSchema>
    : LookupDetailType<TSources, TDetailTypes>,
>(config: EventBridgeRouteInput<TDetailSchema, TSources, TDetailTypes>): EventBridgeRouteBuilder<TDetail> {
  return {
    handle(handler: EventBridgeHandler<TDetail>): EventBridgeRouteDefinition<TDetail> {
      // Cast needed: generic type narrowing from builder input to route definition
      const filters = config.filters as EventBridgeRouteDefinition<TDetail>['filters'];
      const detailSchema = config.detailSchema as EventBridgeRouteDefinition<TDetail>['detailSchema'];
      const middleware = config.middleware as EventBridgeRouteDefinition<TDetail>['middleware'];
      return { filters, detailSchema, middleware, handler };
    },
  };
}

export class EventBridgeRouter implements EventTypeRouter<EventBridgeEventEnvelope, void> {
  private routes: InternalEventBridgeRoute[] = [];
  private middleware: EventBridgeMiddleware[] = [];

  constructor(options?: EventBridgeRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

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
      middleware: definition.middleware,
      handler,
    });
    return this;
  }

  async handleEvent(event: EventBridgeEventEnvelope, context: Context): Promise<void> {
    const route = await this.matchRoute(event);
    if (!route) {
      throw new Error(`No route matched for EventBridge event: ${event.source} / ${event['detail-type']}`);
    }

    const detail = await validateSchema(
      event.detail,
      route.detailSchema,
      `Schema validation failed for event ${event.id}`,
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

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(event: EventBridgeEventEnvelope): Promise<InternalEventBridgeRoute | undefined> {
    const filterInput: EventBridgeFilterInput = {
      event,
      source: event.source,
      detailType: event['detail-type'],
      detail: event.detail,
    };

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.source) {
        const sourceMatch = filterStringMatcher(event.source, filters.source);
        if (!sourceMatch) continue;
      }
      if (filters.detailType) {
        const detailTypeMatch = filterStringMatcher(event['detail-type'], filters.detailType);
        if (!detailTypeMatch) continue;
      }
      if (filters.account) {
        const accountMatch = filterStringMatcher(event.account, filters.account);
        if (!accountMatch) continue;
      }
      if (filters.region) {
        const regionMatch = filterStringMatcher(event.region, filters.region);
        if (!regionMatch) continue;
      }
      if (filters.resource) {
        const { resource } = filters; // Needed here due to TS having different scope for  separate function closure
        const resourceMatch = event.resources.some((res) => filterStringMatcher(res, resource));
        if (!resourceMatch) continue;
      }

      if (filters.custom) {
        const match = await filters.custom(filterInput);
        if (!match) continue;
      }
      return route;
    }
    return undefined;
  }
}

export function createEventBridgeRouter(options?: EventBridgeRouterOptions): EventBridgeRouter {
  return new EventBridgeRouter(options);
}
