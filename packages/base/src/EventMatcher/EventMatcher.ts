import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import { NoRouteMatchedError } from '../errors';
import type { EventTypeMatcher } from '../Latcher';
import { handleEventWithMiddleware } from '../middleware';
import { isKnownEventSource, isObject, orderRoutesBySpecificity, validateSchema } from '../utils';
import type {
  EventFilterInput,
  EventFilters,
  EventHandler,
  EventMatcherMiddleware,
  EventRouteDefinition,
} from './types.js';

interface InternalEventRoute {
  filters: { custom?: (input: EventFilterInput) => boolean | Promise<boolean> };
  eventSchema?: StandardSchemaV1;
  middleware: EventMatcherMiddleware<unknown, unknown>[];
  handler: EventHandler<unknown, unknown>;
}

interface EventRouteInput<TEventSchema extends StandardSchemaV1 | undefined = undefined, TResponse = unknown> {
  filters: EventFilters;
  middleware?: EventMatcherMiddleware<
    TEventSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TEventSchema> : unknown,
    TResponse
  >[];
  eventSchema?: TEventSchema;
}

interface EventRouteBuilder<TPayload, TResponse = unknown> {
  handle<TActualResponse extends TResponse>(
    handler: EventHandler<TPayload, TActualResponse>,
  ): EventRouteDefinition<TPayload, TActualResponse>;
}

export interface EventMatcherOptions<TResponse = unknown> {
  middleware?: EventMatcherMiddleware<unknown, TResponse>[];
}

export class EventMatcher<TResponse = unknown> implements EventTypeMatcher<unknown, TResponse> {
  private routes: InternalEventRoute[] = [];
  private routesOrdered = false;
  private middleware: EventMatcherMiddleware<unknown, TResponse>[];
  private readonly matchedRoutes = new WeakMap<Record<string, unknown>, InternalEventRoute>();
  readonly matchTier = 'fallback'; // Latcher sorts this last:

  constructor(options?: EventMatcherOptions<TResponse>) {
    this.middleware = options?.middleware ?? [];
  }

  async canHandleEvent(event: unknown): Promise<boolean> {
    if (!isObject(event)) return false;
    if (isKnownEventSource(event)) return false;
    const matched = await this.matchRoute(event);
    return matched !== undefined;
  }

  route<TPayload, TRouteResponse extends TResponse>(definition: EventRouteDefinition<TPayload, TRouteResponse>): this {
    // Casts needed: storing typed route in general storage (contravariance)
    const handler = definition.handler as EventHandler<unknown, unknown>;
    const { filters } = definition;
    // @ts-expect-error - storing typed middleware in untyped internal collection (contravariance)
    const middleware: EventMatcherMiddleware<unknown, unknown>[] = definition.middleware ?? [];
    this.routes.push({
      filters,
      eventSchema: definition.eventSchema,
      middleware,
      handler,
    });
    this.routesOrdered = false;
    return this;
  }

  async handleEvent(event: unknown, context: Context): Promise<TResponse> {
    const route = await this.matchRoute(event);
    if (!route) {
      throw new NoRouteMatchedError('No route matched for event');
    }

    const validatedEvent = await validateSchema(event, route.eventSchema, 'Schema validation failed for event');

    const request = { event: validatedEvent, context };

    const allMiddleware = [...this.middleware, ...route.middleware] as EventMatcherMiddleware<unknown, TResponse>[];
    return handleEventWithMiddleware(allMiddleware, request, route.handler as EventHandler<unknown, TResponse>);
  }

  private orderRoutes(): void {
    if (this.routesOrdered) return;

    this.routes = orderRoutesBySpecificity(this.routes);
    this.routesOrdered = true;
  }

  private async matchRoute(event: unknown): Promise<InternalEventRoute | undefined> {
    // canHandleEvent calls handleEvent but both call matchRoute - cache so filters.custom isn't called twice
    const cached = isObject(event) ? this.matchedRoutes.get(event) : undefined;
    if (cached) return cached;

    const filterInput: EventFilterInput = { event };
    this.orderRoutes();

    for (const route of this.routes) {
      const { filters } = route;
      if (filters.custom) {
        const match = await filters.custom(filterInput);
        if (!match) continue;
      }
      if (isObject(event)) this.matchedRoutes.set(event, route);
      return route;
    }
    return undefined;
  }
}

export function defineEventRoute<
  TPayload = unknown,
  TResponse = unknown,
  TEventSchema extends StandardSchemaV1 | undefined = undefined,
>(
  config: EventRouteInput<TEventSchema, TResponse>,
): EventRouteBuilder<
  TEventSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TEventSchema> : TPayload,
  TResponse
> {
  type ResolvedPayload = TEventSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TEventSchema> : TPayload;
  return {
    handle<TActualResponse extends TResponse>(
      handler: EventHandler<ResolvedPayload, TActualResponse>,
    ): EventRouteDefinition<ResolvedPayload, TActualResponse> {
      // Cast needed: generic type narrowing from builder input to route definition
      const eventSchema = config.eventSchema as EventRouteDefinition<ResolvedPayload, TActualResponse>['eventSchema'];
      return {
        filters: config.filters,
        eventSchema,
        middleware: config.middleware as EventMatcherMiddleware<ResolvedPayload, TActualResponse>[] | undefined,
        handler,
      };
    },
  };
}

export function createEventMatcher<TResponse = unknown>(
  options?: EventMatcherOptions<TResponse>,
): EventMatcher<TResponse> {
  return new EventMatcher<TResponse>(options);
}
