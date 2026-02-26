import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type {
  EventBridgeSchedulerFilterInput,
  EventBridgeSchedulerHandler,
  EventBridgeSchedulerRouteDefinition,
} from './eventBridgeSchedulerTypes.js';

interface InternalSchedulerRoute {
  filters: { customFilter?: (input: EventBridgeSchedulerFilterInput) => boolean };
  eventSchema?: Schema<unknown>;
  handler: EventBridgeSchedulerHandler<unknown>;
}

interface EventBridgeSchedulerRouteInput<TEventSchema extends Schema<unknown> | undefined = undefined> {
  filters: { customFilter?: (input: EventBridgeSchedulerFilterInput) => boolean };
  eventSchema?: TEventSchema;
}

interface EventBridgeSchedulerRouteBuilder<TPayload> {
  handle(handler: EventBridgeSchedulerHandler<TPayload>): EventBridgeSchedulerRouteDefinition<TPayload>;
}

// Check if event is from a known AWS source that has its own router
function isKnownEventSource(event: Record<string, unknown>): boolean {
  // Records-based events (SQS, SNS, S3, DynamoDB, Kinesis, CodeCommit, SES)
  if (Array.isArray(event.Records) && event.Records.length > 0) {
    const firstRecord = event.Records[0];
    if (isObject(firstRecord)) {
      const eventSource = firstRecord.eventSource;
      if (typeof eventSource === 'string') {
        const knownSources = ['aws:sqs', 'aws:s3', 'aws:dynamodb', 'aws:kinesis', 'aws:codecommit', 'aws:ses'];
        if (knownSources.includes(eventSource)) {
          return true;
        }
      }
      // SNS uses PascalCase
      if (firstRecord.EventSource === 'aws:sns') {
        return true;
      }
    }
  }

  // Top-level eventSource field (DocumentDB, ActiveMQ, RabbitMQ)
  if (typeof event.eventSource === 'string') {
    const topLevelSources = ['aws:docdb', 'aws:mq', 'aws:rmq'];
    if (topLevelSources.includes(event.eventSource)) {
      return true;
    }
  }

  // EventBridge envelope events (handled by EventBridgeRouter)
  if (typeof event.source === 'string' && typeof event['detail-type'] === 'string' && isObject(event.detail)) {
    return true;
  }

  // ALB
  if (isObject(event.requestContext) && isObject(event.requestContext.elb)) {
    return true;
  }

  // API Gateway V1 (has httpMethod + requestContext, but no rawPath)
  if (typeof event.httpMethod === 'string' && isObject(event.requestContext) && typeof event.rawPath !== 'string') {
    return true;
  }

  // API Gateway V2 / WebSocket
  if (typeof event.rawPath === 'string' && isObject(event.requestContext)) {
    return true;
  }

  // VPC Lattice V1 (uses snake_case raw_path + method)
  if (typeof event.raw_path === 'string' && typeof event.method === 'string') {
    return true;
  }

  // VPC Lattice V2 / AppSync Authorizer (share requestContext)
  if (isObject(event.requestContext)) {
    if (typeof event.requestContext.serviceArn === 'string') {
      return true;
    }
    // AppSync Authorizer (has requestContext.apiId + authorizationToken)
    if (typeof event.requestContext.apiId === 'string' && typeof event.authorizationToken === 'string') {
      return true;
    }
  }

  // Cognito
  if (typeof event.triggerSource === 'string' && typeof event.userPoolId === 'string') {
    return true;
  }

  // AppSync (resolver or channel handler)
  if (isObject(event.info)) {
    const info = event.info as Record<string, unknown>;
    if (typeof info.parentTypeName === 'string' || typeof info.channel === 'string') {
      return true;
    }
  }

  // CloudWatch Logs
  if (isObject(event.awslogs)) {
    return true;
  }

  // CodePipeline
  if (isObject(event['CodePipeline.job'])) {
    return true;
  }

  // Config
  if (typeof event.invokingEvent === 'string' && typeof event.configRuleName === 'string') {
    return true;
  }

  // Connect
  if (event.Name === 'ContactFlowEvent') {
    return true;
  }

  // Lex
  if (isObject(event.sessionState) && isObject(event.bot)) {
    return true;
  }

  // Secrets Manager
  if (typeof event.SecretId === 'string' && typeof event.Step === 'string') {
    return true;
  }

  return false;
}

export class EventBridgeSchedulerRouter implements EventTypeRouter<unknown, void> {
  private routes: InternalSchedulerRoute[] = [];

  canHandleEvent(event: unknown): event is unknown {
    if (!isObject(event)) return false;
    if (isKnownEventSource(event)) return false;
    return this.matchRoute(event) !== undefined;
  }

  route<TPayload>(definition: EventBridgeSchedulerRouteDefinition<TPayload>): this {
    // Cast needed: storing specific handler type in general storage (contravariance)
    const handler = definition.handler as EventBridgeSchedulerHandler<unknown>;
    this.routes.push({
      filters: definition.filters,
      eventSchema: definition.eventSchema,
      handler,
    });
    return this;
  }

  async handleEvent(event: unknown, context: Context): Promise<void> {
    const route = this.matchRoute(event);
    if (!route) {
      throw new Error('No route matched for event');
    }

    const validatedEvent = this.validateSchema(event, route.eventSchema, 'Scheduler event validation failed');
    await route.handler({ event: validatedEvent, context });
  }

  private matchRoute(event: unknown): InternalSchedulerRoute | undefined {
    const filterInput: EventBridgeSchedulerFilterInput = { event };

    return this.routes.find((route) => {
      const { filters } = route;

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

export function defineEventBridgeSchedulerRoute<
  TPayload = unknown,
  TEventSchema extends Schema<unknown> | undefined = undefined,
>(
  config: EventBridgeSchedulerRouteInput<TEventSchema>,
): EventBridgeSchedulerRouteBuilder<TEventSchema extends Schema<unknown> ? InferSchema<TEventSchema> : TPayload> {
  type ResolvedPayload = TEventSchema extends Schema<unknown> ? InferSchema<TEventSchema> : TPayload;
  return {
    handle(
      handler: EventBridgeSchedulerHandler<ResolvedPayload>,
    ): EventBridgeSchedulerRouteDefinition<ResolvedPayload> {
      // Cast needed: generic type narrowing from builder input to route definition
      const eventSchema = config.eventSchema as EventBridgeSchedulerRouteDefinition<ResolvedPayload>['eventSchema'];
      return { filters: config.filters, eventSchema, handler };
    },
  };
}

export function createEventBridgeSchedulerRouter(): EventBridgeSchedulerRouter {
  return new EventBridgeSchedulerRouter();
}
