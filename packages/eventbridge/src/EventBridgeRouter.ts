import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from 'aws-lambda';
import type {
  EventBridgeEventEnvelope,
  EventBridgeFilterInput,
  EventBridgeHandler,
  EventBridgeMiddleware,
  EventBridgeRequest,
  EventBridgeRouteDefinition,
  EventBridgeRouterOptions,
  LookupDetailType,
} from './types.js';

interface InternalEventBridgeRoute {
  filters: EventBridgeRouteDefinition['filters'];
  detailSchema?: StandardSchemaV1;
  middleware?: EventBridgeMiddleware[];
  handler: EventBridgeHandler<unknown>;
}

interface EventBridgeRouteInput<
  TDetailSchema extends StandardSchemaV1 | undefined = undefined,
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
  middleware?: EventBridgeMiddleware[];
}

interface EventBridgeRouteBuilder<TDetail> {
  handle(handler: EventBridgeHandler<TDetail>): EventBridgeRouteDefinition<TDetail>;
}

export function defineRoute<
  TDetailSchema extends StandardSchemaV1 | undefined = undefined,
  const TSources extends readonly string[] | undefined = undefined,
  const TDetailTypes extends readonly string[] | undefined = undefined,
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
    const route = this.matchRoute(event);
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
}

export function createEventBridgeRouter(options?: EventBridgeRouterOptions): EventBridgeRouter {
  return new EventBridgeRouter(options);
}
