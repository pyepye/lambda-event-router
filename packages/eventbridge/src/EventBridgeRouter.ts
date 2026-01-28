import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type {
  EventBridgeEventEnvelope,
  EventBridgeFilterInput,
  EventBridgeFilters,
  EventBridgeHandler,
  EventBridgeRequest,
  EventBridgeRouteDefinition,
  LookupDetailType,
  SchedulerHandler,
  SchedulerRouteDefinition,
} from './types.js';

interface InternalEventBridgeRoute {
  filters: EventBridgeFilters;
  detailSchema?: Schema<unknown>;
  handler: EventBridgeHandler<unknown>;
  isSchedulerRoute: false;
}

interface InternalSchedulerRoute {
  filters: EventBridgeFilters;
  eventSchema?: Schema<unknown>;
  handler: SchedulerHandler<unknown>;
  isSchedulerRoute: true;
}

type InternalRoute = InternalEventBridgeRoute | InternalSchedulerRoute;

interface EventBridgeRouteInput<
  TDetailSchema extends Schema<unknown> | undefined = undefined,
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
}

interface SchedulerRouteInput<TEventSchema extends Schema<unknown> | undefined = undefined> {
  filters: Pick<EventBridgeFilters, 'customFilter'>;
  eventSchema?: TEventSchema;
}

type RouteInput<
  TDetailSchema extends Schema<unknown> | undefined = undefined,
  TEventSchema extends Schema<unknown> | undefined = undefined,
> = EventBridgeRouteInput<TDetailSchema> | SchedulerRouteInput<TEventSchema>;

interface EventBridgeRouteBuilder<TDetail> {
  handle(handler: EventBridgeHandler<TDetail>): EventBridgeRouteDefinition<TDetail>;
}

interface SchedulerRouteBuilder<TPayload> {
  handle(handler: SchedulerHandler<TPayload>): SchedulerRouteDefinition<TPayload>;
}

function hasProperty<T extends object, K extends string>(obj: T, key: K): obj is T & Record<K, unknown> {
  return Object.hasOwn(obj, key);
}

function isSchedulerRouteInput(config: RouteInput): config is SchedulerRouteInput {
  if (hasProperty(config, 'eventSchema')) {
    return true;
  }
  if (hasProperty(config, 'detailSchema')) {
    return false;
  }
  const { filters } = config;
  const hasSources = hasProperty(filters, 'sources') && filters.sources;
  const hasDetailTypes = hasProperty(filters, 'detailTypes') && filters.detailTypes;
  const hasAccounts = hasProperty(filters, 'accounts') && filters.accounts;
  const hasRegions = hasProperty(filters, 'regions') && filters.regions;
  const hasResources = hasProperty(filters, 'resources') && filters.resources;
  const hasStandardFilters = hasSources || hasDetailTypes || hasAccounts || hasRegions || hasResources;
  return !hasStandardFilters;
}

// EventBridge route - type inferred from schema if provided, otherwise from sources/detailTypes
export function defineRoute<
  TDetailSchema extends Schema<unknown> | undefined = undefined,
  const TSources extends readonly string[] | undefined = undefined,
  const TDetailTypes extends readonly string[] | undefined = undefined,
  TDetail = TDetailSchema extends Schema<unknown>
    ? InferSchema<TDetailSchema>
    : LookupDetailType<TSources, TDetailTypes>,
>(config: EventBridgeRouteInput<TDetailSchema, TSources, TDetailTypes>): EventBridgeRouteBuilder<TDetail>;

// Scheduler route
export function defineRoute<TPayload = unknown, TEventSchema extends Schema<unknown> | undefined = undefined>(
  config: SchedulerRouteInput<TEventSchema>,
): SchedulerRouteBuilder<TEventSchema extends Schema<unknown> ? InferSchema<TEventSchema> : TPayload>;

export function defineRoute(config: RouteInput): EventBridgeRouteBuilder<unknown> | SchedulerRouteBuilder<unknown> {
  const isScheduler = isSchedulerRouteInput(config);
  if (isScheduler) {
    return {
      handle(handler: SchedulerHandler): SchedulerRouteDefinition {
        return { filters: config.filters, eventSchema: config.eventSchema, handler };
      },
    };
  }
  return {
    handle(handler: EventBridgeHandler): EventBridgeRouteDefinition {
      return { filters: config.filters, detailSchema: config.detailSchema, handler };
    },
  };
}

function isEventBridgeEvent(event: unknown): event is EventBridgeEventEnvelope {
  if (!isObject(event)) return false;
  if (typeof event.source !== 'string') return false;
  /* v8 ignore next -- @preserve - Guard is for TS. EventBridge always provides source, detail-type, and detail together - checked individually for type narrowing */
  if (typeof event['detail-type'] !== 'string') return false;
  /* v8 ignore next -- @preserve - Guard is for TS. EventBridge always provides detail as an object - checked individually for type narrowing */
  if (!isObject(event.detail)) return false;
  return true;
}

// Check if event is from a known AWS source that has its own router
function isKnownEventSource(event: unknown): boolean {
  /* v8 ignore next -- @preserve - Guard is for TS. canHandleEvent already checks isObject */
  if (!isObject(event)) return false;

  // Records-based events (SQS, SNS, S3, DynamoDB, Kinesis)
  if (Array.isArray(event.Records) && event.Records.length > 0) {
    const firstRecord = event.Records[0];
    if (isObject(firstRecord)) {
      const eventSource = firstRecord.eventSource;
      if (typeof eventSource === 'string') {
        const knownSources = ['aws:sqs', 'aws:s3', 'aws:dynamodb', 'aws:kinesis'];
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

  // API Gateway V2
  if (typeof event.rawPath === 'string' && isObject(event.requestContext)) {
    return true;
  }

  // Cognito
  if (typeof event.triggerSource === 'string' && typeof event.userPoolId === 'string') {
    return true;
  }

  return false;
}

export class EventBridgeRouter implements EventTypeRouter<unknown, void> {
  private routes: InternalRoute[] = [];

  canHandleEvent(event: unknown): event is unknown {
    if (!isObject(event)) return false;
    if (isKnownEventSource(event)) return false;
    return true;
  }

  route<TDetail, TPayload>(definition: EventBridgeRouteDefinition<TDetail> | SchedulerRouteDefinition<TPayload>): this {
    if (this.isSchedulerRouteDefinition(definition)) {
      // Cast needed: storing specific handler type in general storage (contravariance)
      const handler = definition.handler as SchedulerHandler<unknown>;
      this.routes.push({
        filters: definition.filters,
        eventSchema: definition.eventSchema,
        handler,
        isSchedulerRoute: true,
      });
    } else {
      // Cast needed: storing specific handler type in general storage (contravariance)
      const handler = definition.handler as EventBridgeHandler<unknown>;
      this.routes.push({
        filters: definition.filters,
        detailSchema: definition.detailSchema,
        handler,
        isSchedulerRoute: false,
      });
    }
    return this;
  }

  private isSchedulerRouteDefinition<TDetail, TPayload>(
    definition: EventBridgeRouteDefinition<TDetail> | SchedulerRouteDefinition<TPayload>,
  ): definition is SchedulerRouteDefinition<TPayload> {
    if (hasProperty(definition, 'eventSchema')) {
      return true;
    }
    if (hasProperty(definition, 'detailSchema')) {
      return false;
    }

    const { filters } = definition;
    const hasSources = hasProperty(filters, 'sources') && filters.sources;
    const hasDetailTypes = hasProperty(filters, 'detailTypes') && filters.detailTypes;
    const hasAccounts = hasProperty(filters, 'accounts') && filters.accounts;
    const hasRegions = hasProperty(filters, 'regions') && filters.regions;
    const hasResources = hasProperty(filters, 'resources') && filters.resources;
    const hasStandardFilters = hasSources || hasDetailTypes || hasAccounts || hasRegions || hasResources;
    return !hasStandardFilters;
  }

  async handleEvent(event: unknown, context: Context): Promise<void> {
    const envelope = isEventBridgeEvent(event) ? event : undefined;

    const route = this.matchRoute(event, envelope);
    if (!route) {
      if (envelope) {
        throw new Error(`No route matched for EventBridge event: ${envelope.source} / ${envelope['detail-type']}`);
      }
      throw new Error('No route matched for event');
    }

    if (route.isSchedulerRoute) {
      const validatedEvent = this.validateSchema(event, route.eventSchema, 'Scheduler event validation failed');
      await route.handler(validatedEvent);
    } else {
      if (!envelope) {
        throw new Error('Route expects standard EventBridge event but received different format');
      }

      const detail = this.validateSchema(
        envelope.detail,
        route.detailSchema,
        `Detail validation failed for event ${envelope.id}`,
      );

      const request: EventBridgeRequest = {
        source: envelope.source,
        detailType: envelope['detail-type'],
        detail,
        account: envelope.account,
        region: envelope.region,
        time: envelope.time,
        resources: envelope.resources,
        id: envelope.id,
        event: envelope,
        context,
      };

      await route.handler(request);
    }
  }

  private matchRoute(event: unknown, envelope: EventBridgeEventEnvelope | undefined): InternalRoute | undefined {
    const filterInput: EventBridgeFilterInput = {
      event,
      source: envelope?.source,
      detailType: envelope?.['detail-type'],
      detail: envelope?.detail,
    };

    return this.routes.find((route) => {
      const { filters } = route;

      if (envelope) {
        if (filters.sources && !filters.sources.includes(envelope.source)) {
          return false;
        }
        if (filters.detailTypes && !filters.detailTypes.includes(envelope['detail-type'])) {
          return false;
        }
        if (filters.accounts && !filters.accounts.includes(envelope.account)) {
          return false;
        }
        if (filters.regions && !filters.regions.includes(envelope.region)) {
          return false;
        }
        if (filters.resources) {
          const hasMatchingResource = envelope.resources.some((r) => filters.resources?.includes(r));
          if (!hasMatchingResource) {
            return false;
          }
        }
      } else {
        // Non-standard events can only match via customFilter
        if (filters.sources || filters.detailTypes || filters.accounts || filters.regions || filters.resources) {
          return false;
        }
      }

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

export function createEventBridgeRouter(): EventBridgeRouter {
  return new EventBridgeRouter();
}
