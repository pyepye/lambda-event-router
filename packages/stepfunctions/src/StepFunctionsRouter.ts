import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject, validateSchema } from '@lambda-event-router/base';

import type {
  StepFunctionsFilters,
  StepFunctionsHandler,
  StepFunctionsRouteDefinition,
  StepFunctionsTaskTokenHandler,
  StepFunctionsTaskTokenRequest,
  StepFunctionsTaskTokenRouteDefinition,
} from './types.js';

interface InternalRoute {
  filters: StepFunctionsFilters;
  eventSchema?: StandardSchemaV1;
  isTaskTokenRoute: boolean;
  handler: (input: unknown) => Promise<unknown>;
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
}): TaskTokenRouteBuilder<TInput>;

// Regular route
export function defineRoute<
  TEventSchema extends StandardSchemaV1 | undefined = undefined,
  TInput = TEventSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TEventSchema> : unknown,
>(config: { filters: StepFunctionsFilters; eventSchema?: TEventSchema }): RegularRouteBuilder<TInput>;

export function defineRoute(config: {
  filters: StepFunctionsFilters;
  eventSchema?: StandardSchemaV1;
}): TaskTokenRouteBuilder<unknown> | RegularRouteBuilder<unknown> {
  return {
    handle(
      handler: StepFunctionsHandler | StepFunctionsTaskTokenHandler,
    ): StepFunctionsRouteDefinition | StepFunctionsTaskTokenRouteDefinition {
      return {
        filters: config.filters,
        eventSchema: config.eventSchema,
        handler,
      } as StepFunctionsRouteDefinition | StepFunctionsTaskTokenRouteDefinition;
    },
  } as TaskTokenRouteBuilder<unknown> | RegularRouteBuilder<unknown>;
}

export class StepFunctionsRouter implements EventTypeRouter<unknown, unknown> {
  private routes: InternalRoute[] = [];

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
      handler: definition.handler as (input: unknown) => Promise<unknown>,
      isTaskTokenRoute: isTaskToken,
    });
    return this;
  }

  async handleEvent(event: unknown): Promise<unknown> {
    const route = await this.matchRoute(event);
    if (!route) {
      throw new Error('No route matched for Step Functions event');
    }

    if (route.isTaskTokenRoute) {
      return this.handleTaskTokenRoute(event, route);
    }

    const validatedEvent = await validateSchema(event, route.eventSchema, 'Event validation failed');
    return route.handler(validatedEvent);
  }

  private async handleTaskTokenRoute(event: unknown, route: InternalRoute): Promise<unknown> {
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
    };

    return route.handler(request);
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

export function createStepFunctionsRouter(): StepFunctionsRouter {
  return new StepFunctionsRouter();
}
