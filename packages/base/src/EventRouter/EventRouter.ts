import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import { NoRouteMatchedError } from '../errors';
import type { EventTypeRouter } from '../LambdaRouter';
import { handleEventWithMiddleware } from '../middleware';
import { isObject, validateSchema } from '../utils';
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
  filters: EventFilters<TEventSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TEventSchema> : unknown>;
  middleware?: EventRouterMiddleware<
    TEventSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TEventSchema> : unknown,
    TResponse
  >[];
  eventSchema?: TEventSchema;
}

interface EventRouteBuilder<TPayload, TResponse = unknown> {
  handle(handler: EventHandler<TPayload, TResponse>): EventRouteDefinition<TPayload, TResponse>;
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
    const topLevelSources = ['aws:docdb', 'aws:mq', 'aws:rmq', 'aws:kafka', 'SelfManagedKafka'];
    if (topLevelSources.includes(event.eventSource)) {
      return true;
    }
  }

  // EventBridge envelope events (source + detail-type + detail)
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

  // Firehose
  if (typeof event.deliveryStreamArn === 'string' && Array.isArray(event.records)) {
    return true;
  }

  // S3 Batch
  if (
    typeof event.invocationSchemaVersion === 'string' &&
    typeof event.invocationId === 'string' &&
    isObject(event.job) &&
    Array.isArray(event.tasks)
  ) {
    return true;
  }

  // AppSync (resolver or channel handler)
  if (isObject(event.info)) {
    if (typeof event.info.parentTypeName === 'string' || typeof event.info.channel === 'string') {
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

  route<TPayload>(definition: EventRouteDefinition<TPayload, TResponse>): this {
    // Casts needed: storing typed route in general storage (contravariance)
    const handler = definition.handler as EventHandler<unknown, unknown>;
    const filters = definition.filters as InternalEventRoute['filters'];
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
    handle(handler: EventHandler<ResolvedPayload, TResponse>): EventRouteDefinition<ResolvedPayload, TResponse> {
      // Cast needed: generic type narrowing from builder input to route definition
      const eventSchema = config.eventSchema as EventRouteDefinition<ResolvedPayload, TResponse>['eventSchema'];
      return {
        filters: config.filters,
        eventSchema,
        middleware: config.middleware as EventRouterMiddleware<ResolvedPayload, TResponse>[] | undefined,
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
