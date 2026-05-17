import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, NoRouteMatchedError, validateSchema } from '@lambda-event-router/base';

import type {
  StepFunctionsFilters,
  StepFunctionsHandler,
  StepFunctionsMiddleware,
  StepFunctionsRequest,
  StepFunctionsRouteDefinition,
  StepFunctionsTaskTokenHandler,
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
  middleware?: StepFunctionsMiddleware[];
}): TaskTokenRouteBuilder<TInput>;

// Regular route
export function defineRoute<
  TEventSchema extends StandardSchemaV1 | undefined = undefined,
  TInput = TEventSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TEventSchema> : unknown,
>(config: {
  filters: StepFunctionsFilters;
  eventSchema?: TEventSchema;
  middleware?: StepFunctionsMiddleware[];
}): RegularRouteBuilder<TInput>;

export function defineRoute(config: {
  filters: StepFunctionsFilters;
  eventSchema?: StandardSchemaV1;
  middleware?: StepFunctionsMiddleware[];
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
  private routes: InternalRoute[] = [];
  private middleware: StepFunctionsMiddleware[];

  constructor(options?: StepFunctionsRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is unknown {
    if (!isObject(event)) return false;
    if (this.isKnownEventSource(event)) return false;
    return true;
  }

  private isKnownEventSource(event: Record<string, unknown>): boolean {
    // Records-based events (SQS, SNS, S3, DynamoDB, Kinesis)
    if (Array.isArray(event.Records) && event.Records.length > 0) {
      const firstRecord = event.Records[0];
      if (isObject(firstRecord)) {
        if (typeof firstRecord.eventSource === 'string') {
          const knownSources = ['aws:sqs', 'aws:s3', 'aws:dynamodb', 'aws:kinesis'];
          if (knownSources.includes(firstRecord.eventSource)) {
            return true;
          }
        }
        // SNS uses PascalCase
        if (firstRecord.EventSource === 'aws:sns') {
          return true;
        }
      }
    }

    // API Gateway V2
    if (typeof event.rawPath === 'string' && isObject(event.requestContext)) {
      return true;
    }

    // Cognito
    if (typeof event.triggerSource === 'string' && typeof event.userPoolId === 'string') {
      return true;
    }

    // Standard EventBridge events
    if (typeof event.source === 'string' && typeof event['detail-type'] === 'string' && isObject(event.detail)) {
      return true;
    }

    return false;
  }

  route<TInput>(
    definition: StepFunctionsRouteDefinition<TInput> | StepFunctionsTaskTokenRouteDefinition<TInput>,
  ): this {
    const isTaskToken = definition.filters.taskToken === true;
    this.routes.push({
      filters: definition.filters,
      eventSchema: definition.eventSchema,
      middleware: definition.middleware ?? [],
      handler: definition.handler as (request: never) => Promise<unknown>,
      isTaskTokenRoute: isTaskToken,
    });
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

  // Middleware is typed over { event, context }, which a task token request also carries. The cast
  // lets both request shapes share one chain rather than needing a middleware type each.
  private async runRoute(route: InternalRoute, request: StepFunctionsRequest): Promise<unknown> {
    const allMiddleware = [...this.middleware, ...route.middleware];
    return handleEventWithMiddleware(
      allMiddleware,
      request,
      route.handler as (r: StepFunctionsRequest) => Promise<unknown>,
    );
  }

  private async matchRoute(event: unknown): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.taskToken === true) {
        if (!isObject(event) || typeof event.TaskToken !== 'string') {
          continue;
        }
      }

      if (filters.customFilter) {
        const match = await filters.customFilter({ event });
        if (!match) continue;
      }
      return route;
    }
    return undefined;
  }
}

export function createStepFunctionsRouter(options?: StepFunctionsRouterOptions): StepFunctionsRouter {
  return new StepFunctionsRouter(options);
}
