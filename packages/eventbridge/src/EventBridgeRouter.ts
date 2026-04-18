import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from 'aws-lambda';
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
        const sources = Array.isArray(filters.source) ? filters.source : [filters.source];
        if (!sources.includes(event.source)) {
          continue;
        }
      }
      if (filters.detailType) {
        const detailTypes = Array.isArray(filters.detailType) ? filters.detailType : [filters.detailType];
        if (!detailTypes.includes(event['detail-type'])) {
          continue;
        }
      }
      if (filters.account) {
        const accounts = Array.isArray(filters.account) ? filters.account : [filters.account];
        if (!accounts.includes(event.account)) {
          continue;
        }
      }
      if (filters.region) {
        const regions = Array.isArray(filters.region) ? filters.region : [filters.region];
        if (!regions.includes(event.region)) {
          continue;
        }
      }
      if (filters.resource) {
        const resources = Array.isArray(filters.resource) ? filters.resource : [filters.resource];
        const hasMatchingResource = event.resources.some((r) => resources?.includes(r));
        if (!hasMatchingResource) {
          continue;
        }
      }

      if (filters.customFilter) {
        const match = await filters.customFilter(filterInput);
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
