import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import { NoRouteMatchedError } from '../errors';
import type { EventTypeRouter } from '../LambdaRouter';
import { handleEventWithMiddleware } from '../middleware';
import { isKnownEventSource, isObject, validateSchema } from '../utils';
import type {
  EventFilterInput,
  EventFilters,
  EventHandler,
  EventRouteDefinition,
  EventRouterMiddleware,
} from './types.js';

interface InternalEventRoute {
  filters: { custom?: (input: EventFilterInput) => boolean | Promise<boolean> };
  eventSchema?: StandardSchemaV1;
  middleware: EventRouterMiddleware<unknown, unknown>[];
  handler: EventHandler<unknown, unknown>;
}

interface EventRouteInput<TEventSchema extends StandardSchemaV1 | undefined = undefined, TResponse = unknown> {
  filters: EventFilters;
  middleware?: EventRouterMiddleware<
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

export interface EventRouterOptions<TResponse = unknown> {
  middleware?: EventRouterMiddleware<unknown, TResponse>[];
}

export class EventRouter<TResponse = unknown> implements EventTypeRouter<unknown, TResponse> {
  private routes: InternalEventRoute[] = [];
  private middleware: EventRouterMiddleware<unknown, TResponse>[];
  private readonly matchedRoutes = new WeakMap<Record<string, unknown>, InternalEventRoute>();
  readonly matchTier = 'fallback'; // LambdaRouter sorts this last:

  constructor(options?: EventRouterOptions<TResponse>) {
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
    const middleware: EventRouterMiddleware<unknown, unknown>[] = definition.middleware ?? [];
    this.routes.push({
      filters,
      eventSchema: definition.eventSchema,
      middleware,
      handler,
    });
    return this;
  }

  async handleEvent(event: unknown, context: Context): Promise<TResponse> {
    const route = await this.matchRoute(event);
    if (!route) {
      throw new NoRouteMatchedError('No route matched for event');
    }

    const validatedEvent = await validateSchema(event, route.eventSchema, 'Schema validation failed for event');

    const request = { event: validatedEvent, context };

    const allMiddleware = [...this.middleware, ...route.middleware] as EventRouterMiddleware<unknown, TResponse>[];
    return handleEventWithMiddleware(allMiddleware, request, route.handler as EventHandler<unknown, TResponse>);
  }

  private async matchRoute(event: unknown): Promise<InternalEventRoute | undefined> {
    // canHandleEvent calls handleEvent but both call matchRoute - cache so filters.custom isn't called twice
    const cached = isObject(event) ? this.matchedRoutes.get(event) : undefined;
    if (cached) return cached;

    const filterInput: EventFilterInput = { event };
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
        middleware: config.middleware as EventRouterMiddleware<ResolvedPayload, TActualResponse>[] | undefined,
        handler,
      };
    },
  };
}

export function createEventRouter<TResponse = unknown>(
  options?: EventRouterOptions<TResponse>,
): EventRouter<TResponse> {
  return new EventRouter<TResponse>(options);
}
