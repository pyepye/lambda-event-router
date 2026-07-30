import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import {
  handleEventWithMiddleware,
  isKnownEventSource,
  isObject,
  NoRouteMatchedError,
  orderRoutesBySpecificity,
  validateSchema,
} from '@lambda-event-router/base';

import type {
  StepFunctionsFilters,
  StepFunctionsHandler,
  StepFunctionsMiddleware,
  StepFunctionsRequest,
  StepFunctionsRouteDefinition,
  StepFunctionsTaskTokenHandler,
  StepFunctionsTaskTokenMiddleware,
  StepFunctionsTaskTokenRequest,
  StepFunctionsTaskTokenRouteDefinition,
} from './types.js';

export interface StepFunctionsRouterOptions {
  middleware?: StepFunctionsMiddleware[];
}

interface InternalRoute {
  filters: StepFunctionsFilters;
  eventSchema?: StandardSchemaV1;
  isTaskTokenRoute: boolean;
  middleware: StepFunctionsMiddleware[];
  handler: (request: never) => Promise<unknown>;
}

interface TaskTokenRouteBuilder<TInput> {
  handle(handler: StepFunctionsTaskTokenHandler<TInput>): StepFunctionsTaskTokenRouteDefinition<TInput>;
}

interface RegularRouteBuilder<TInput> {
  handle(handler: StepFunctionsHandler<TInput>): StepFunctionsRouteDefinition<TInput>;
}

// TaskToken route - when filters include taskToken: true
export function defineRoute<
  TEventSchema extends StandardSchemaV1 | undefined = undefined,
  TInput = TEventSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TEventSchema> : unknown,
>(config: {
  filters: StepFunctionsFilters & { taskToken: true };
  eventSchema?: TEventSchema;
  middleware?: StepFunctionsTaskTokenMiddleware<unknown, NoInfer<TInput>>[];
}): TaskTokenRouteBuilder<TInput>;

// Regular route
export function defineRoute<
  TEventSchema extends StandardSchemaV1 | undefined = undefined,
  TInput = TEventSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TEventSchema> : unknown,
>(config: {
  filters: StepFunctionsFilters;
  eventSchema?: TEventSchema;
  middleware?: StepFunctionsMiddleware<unknown, NoInfer<TInput>>[];
}): RegularRouteBuilder<TInput>;

export function defineRoute(config: {
  filters: StepFunctionsFilters;
  eventSchema?: StandardSchemaV1;
  middleware?: StepFunctionsMiddleware[] | StepFunctionsTaskTokenMiddleware[];
}): TaskTokenRouteBuilder<unknown> | RegularRouteBuilder<unknown> {
  return {
    handle(
      handler: StepFunctionsHandler | StepFunctionsTaskTokenHandler,
    ): StepFunctionsRouteDefinition | StepFunctionsTaskTokenRouteDefinition {
      return {
        filters: config.filters,
        eventSchema: config.eventSchema,
        middleware: config.middleware,
        handler,
      } as StepFunctionsRouteDefinition | StepFunctionsTaskTokenRouteDefinition;
    },
  } as TaskTokenRouteBuilder<unknown> | RegularRouteBuilder<unknown>;
}

export class StepFunctionsRouter implements EventTypeRouter<unknown, unknown> {
  readonly matchTier = 'catchAll';
  private routes: InternalRoute[] = [];
  private routesOrdered = false;
  private middleware: StepFunctionsMiddleware[];
  private readonly matchedRoutes = new WeakMap<Record<string, unknown>, InternalRoute>();

  constructor(options?: StepFunctionsRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  async canHandleEvent(event: unknown): Promise<boolean> {
    if (!isObject(event)) return false;
    if (isKnownEventSource(event)) return false;
    const matched = await this.matchRoute(event);
    return matched !== undefined;
  }

  route<TInput>(definition: StepFunctionsTaskTokenRouteDefinition<TInput>): this;
  route<TInput>(definition: StepFunctionsRouteDefinition<TInput>): this;
  route<TInput>(
    definition: StepFunctionsRouteDefinition<TInput> | StepFunctionsTaskTokenRouteDefinition<TInput>,
  ): this {
    const isTaskToken = definition.filters.taskToken === true;
    this.routes.push({
      filters: definition.filters,
      eventSchema: definition.eventSchema,
      // Cast needed: storing a payload-typed chain in general storage (contravariance). Both request
      // shapes reach the chain through runRoute, which casts the request the same way.
      middleware: (definition.middleware ?? []) as StepFunctionsMiddleware[],
      handler: definition.handler as (request: never) => Promise<unknown>,
      isTaskTokenRoute: isTaskToken,
    });
    this.routesOrdered = false;
    return this;
  }

  async handleEvent(event: unknown, context: Context): Promise<unknown> {
    const route = await this.matchRoute(event);
    if (!route) {
      throw new NoRouteMatchedError('No route matched for Step Functions event');
    }

    if (route.isTaskTokenRoute) {
      return this.handleTaskTokenRoute(event, context, route);
    }

    const validatedEvent = await validateSchema(event, route.eventSchema, 'Event validation failed');
    return this.runRoute(route, { event: validatedEvent, context });
  }

  private async handleTaskTokenRoute(event: unknown, context: Context, route: InternalRoute): Promise<unknown> {
    /* v8 ignore next -- @preserve - Guard is for TS. matchRoute already verified event is an object with TaskToken */
    if (!isObject(event)) {
      throw new Error('Expected object event for TaskToken route');
    }

    const { TaskToken, ...input } = event;
    /* v8 ignore next -- @preserve - Guard is for TS. matchRoute already verified TaskToken is a string */
    if (typeof TaskToken !== 'string') {
      throw new Error('Expected TaskToken in event but none found');
    }

    const validatedInput = await validateSchema(input, route.eventSchema, 'Event validation failed');
    const request: StepFunctionsTaskTokenRequest = {
      taskToken: TaskToken,
      input: validatedInput,
      event,
      context,
    };

    return this.runRoute(route, request);
  }

  // A task token request carries the two keys StepFunctionsRequest declares, so the cast lets both
  // request shapes run through one chain.
  private async runRoute(route: InternalRoute, request: StepFunctionsRequest): Promise<unknown> {
    const allMiddleware = [...this.middleware, ...route.middleware];
    return handleEventWithMiddleware(
      allMiddleware,
      request,
      route.handler as (r: StepFunctionsRequest) => Promise<unknown>,
    );
  }

  private orderRoutes(): void {
    if (this.routesOrdered) return;

    this.routes = orderRoutesBySpecificity(this.routes);
    this.routesOrdered = true;
  }

  private async matchRoute(event: unknown): Promise<InternalRoute | undefined> {
    // canHandleEvent and handleEvent both match the same event, so cache the hit to run filters.custom once
    const cached = isObject(event) ? this.matchedRoutes.get(event) : undefined;
    if (cached) return cached;

    this.orderRoutes();

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.taskToken !== undefined) {
        const hasTaskToken = isObject(event) && typeof event.TaskToken === 'string';
        if (hasTaskToken !== filters.taskToken) continue;
      }

      if (filters.custom) {
        const match = await filters.custom({ event });
        if (!match) continue;
      }
      if (isObject(event)) this.matchedRoutes.set(event, route);
      return route;
    }
    return undefined;
  }
}

export function createStepFunctionsRouter(options?: StepFunctionsRouterOptions): StepFunctionsRouter {
  return new StepFunctionsRouter(options);
}
