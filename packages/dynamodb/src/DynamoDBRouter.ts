import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { Context, DynamoDBBatchResponse, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import {
  filterStringMatcher,
  handleEventWithMiddleware,
  isObject,
  logger,
  validateSchema,
} from '@lambda-event-router/base';

import type {
  DynamoDBEventName,
  DynamoDBFilters,
  DynamoDBInsertRouteDefinition,
  DynamoDBModifyRouteDefinition,
  DynamoDBRemoveRouteDefinition,
  DynamoDBRequest,
  DynamoDBRouteDefinition,
  DynamoDBRouterOptions,
  DynamoDBViewType,
} from './types.js';

type UnmarshallInput = Parameters<typeof unmarshall>[0];

interface InternalRoute {
  filters: DynamoDBFilters;
  keysSchema?: StandardSchemaV1;
  newImageSchema?: StandardSchemaV1;
  oldImageSchema?: StandardSchemaV1;
  middleware: Middleware<DynamoDBRequest, void>[];
  handler: (request: DynamoDBRequest) => Promise<void>;
}

// Events whose records include newImage / oldImage. Matches the branches of
// DynamoDBRequest in types.ts
type EventsWithNewImage = 'INSERT' | 'MODIFY';
type EventsWithOldImage = 'MODIFY' | 'REMOVE';

// Normalize the eventName filter (single value or array) to its element union
type EventNameUnion<T> = T extends readonly DynamoDBEventName[] ? T[number] : T extends DynamoDBEventName ? T : never;

// Allow a schema option only when at least one filtered event carries that image.
// When no eventName filter is set, the option is always allowed.
type NewImageSchemaOption<
  TEventNames extends DynamoDBEventName | readonly DynamoDBEventName[] | undefined,
  TNewImageSchema extends StandardSchemaV1 | undefined,
> = TEventNames extends DynamoDBEventName | readonly DynamoDBEventName[]
  ? [Extract<EventNameUnion<TEventNames>, EventsWithNewImage>] extends [never]
    ? { newImageSchema?: never }
    : { newImageSchema?: TNewImageSchema }
  : { newImageSchema?: TNewImageSchema };

type OldImageSchemaOption<
  TEventNames extends DynamoDBEventName | readonly DynamoDBEventName[] | undefined,
  TOldImageSchema extends StandardSchemaV1 | undefined,
> = TEventNames extends DynamoDBEventName | readonly DynamoDBEventName[]
  ? [Extract<EventNameUnion<TEventNames>, EventsWithOldImage>] extends [never]
    ? { oldImageSchema?: never }
    : { oldImageSchema?: TOldImageSchema }
  : { oldImageSchema?: TOldImageSchema };

type DynamoDBRouteInputFilters<
  TEventNames extends DynamoDBEventName | readonly DynamoDBEventName[] | undefined,
  TViewTypes extends DynamoDBViewType | readonly DynamoDBViewType[] | undefined,
> = Omit<DynamoDBFilters, 'eventName' | 'streamViewType'> & {
  eventName?: TEventNames;
  streamViewType?: TViewTypes;
};

type RouteInput<
  TKeysSchema extends StandardSchemaV1 | undefined,
  TNewImageSchema extends StandardSchemaV1 | undefined,
  TOldImageSchema extends StandardSchemaV1 | undefined,
  TEventNames extends DynamoDBEventName | readonly DynamoDBEventName[] | undefined,
  TViewTypes extends DynamoDBViewType | readonly DynamoDBViewType[] | undefined,
> = {
  filters: DynamoDBRouteInputFilters<TEventNames, TViewTypes>;
  keysSchema?: TKeysSchema;
  middleware?: Middleware<DynamoDBRequest, void>[];
} & NewImageSchemaOption<TEventNames, TNewImageSchema> &
  OldImageSchemaOption<TEventNames, TOldImageSchema>;

// Narrow DynamoDBRequest to the branches that match the filtered eventName(s).
// Relies on DynamoDBRequest being a discriminated union over eventName in types.ts
type FiltersToRequest<
  TEventNames extends DynamoDBEventName | readonly DynamoDBEventName[] | undefined,
  TKeys,
  TNewItem,
  TOldItem,
> = TEventNames extends DynamoDBEventName | readonly DynamoDBEventName[]
  ? Extract<DynamoDBRequest<TKeys, TNewItem, TOldItem>, { eventName: EventNameUnion<TEventNames> }>
  : DynamoDBRequest<TKeys, TNewItem, TOldItem>;

interface RouteBuilder<
  TKeys,
  TNewItem,
  TOldItem,
  TEventNames extends DynamoDBEventName | readonly DynamoDBEventName[] | undefined,
> {
  handle(
    handler: (request: FiltersToRequest<TEventNames, TKeys, TNewItem, TOldItem>) => Promise<void>,
  ): DynamoDBRouteDefinition<TKeys, TNewItem, TOldItem>;
}

export function defineRoute<
  TKeysSchema extends StandardSchemaV1 | undefined = undefined,
  TNewImageSchema extends StandardSchemaV1 | undefined = undefined,
  TOldImageSchema extends StandardSchemaV1 | undefined = undefined,
  const TEventNames extends DynamoDBEventName | readonly DynamoDBEventName[] | undefined = undefined,
  const TViewTypes extends DynamoDBViewType | readonly DynamoDBViewType[] | undefined = undefined,
  TKeys = TKeysSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TKeysSchema> : Record<string, unknown>,
  TNewItem = TNewImageSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TNewImageSchema>
    : Record<string, unknown>,
  TOldItem = TOldImageSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TOldImageSchema>
    : Record<string, unknown>,
>(
  config: RouteInput<TKeysSchema, TNewImageSchema, TOldImageSchema, TEventNames, TViewTypes>,
): RouteBuilder<TKeys, TNewItem, TOldItem, TEventNames> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): DynamoDBRouteDefinition<TKeys, TNewItem, TOldItem> {
      // Casts needed: narrow generic input back to the public route definition shape (contravariance on handler union)
      const filters = config.filters as DynamoDBRouteDefinition<TKeys, TNewItem, TOldItem>['filters'];
      const keysSchema = config.keysSchema as StandardSchemaV1<unknown, TKeys> | undefined;
      const newImageSchema = config.newImageSchema as StandardSchemaV1<unknown, TNewItem> | undefined;
      const oldImageSchema = config.oldImageSchema as StandardSchemaV1<unknown, TOldItem> | undefined;
      const middleware = config.middleware as DynamoDBRouteDefinition<TKeys, TNewItem, TOldItem>['middleware'];
      return {
        filters,
        keysSchema,
        newImageSchema,
        oldImageSchema,
        middleware,
        handler: handler as (request: DynamoDBRequest<TKeys, TNewItem, TOldItem>) => Promise<void>,
      };
    },
  };
}

export class DynamoDBRouter implements EventTypeRouter<DynamoDBStreamEvent, undefined | DynamoDBBatchResponse> {
  private routes: InternalRoute[] = [];
  private batchItemFailures: boolean;
  private middleware: Middleware<DynamoDBRequest, void>[];

  constructor(options?: DynamoDBRouterOptions) {
    this.batchItemFailures = options?.batchItemFailures ?? false;
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is DynamoDBStreamEvent {
    if (!isObject(event)) return false;
    if (!Array.isArray(event.Records)) return false;

    const firstRecord = event.Records[0];
    if (!isObject(firstRecord)) return false;

    return firstRecord.eventSource === 'aws:dynamodb';
  }

  route<TKeys, TNewItem, TOldItem>(definition: DynamoDBRouteDefinition<TKeys, TNewItem, TOldItem>): this {
    return this.addRoute({
      filters: definition.filters,
      keysSchema: definition.keysSchema,
      newImageSchema: definition.newImageSchema,
      oldImageSchema: definition.oldImageSchema,
      middleware: definition.middleware as InternalRoute['middleware'],
      handler: definition.handler as InternalRoute['handler'],
    });
  }

  insert<TKeys, TNewItem>(definition: DynamoDBInsertRouteDefinition<TKeys, TNewItem>): this {
    return this.addRoute({
      filters: { ...definition.filters, eventName: 'INSERT' },
      keysSchema: definition.keysSchema,
      newImageSchema: definition.newImageSchema,
      middleware: definition.middleware as InternalRoute['middleware'],
      handler: definition.handler as InternalRoute['handler'],
    });
  }

  modify<TKeys, TNewItem, TOldItem>(definition: DynamoDBModifyRouteDefinition<TKeys, TNewItem, TOldItem>): this {
    return this.addRoute({
      filters: { ...definition.filters, eventName: 'MODIFY' },
      keysSchema: definition.keysSchema,
      newImageSchema: definition.newImageSchema,
      oldImageSchema: definition.oldImageSchema,
      middleware: definition.middleware as InternalRoute['middleware'],
      handler: definition.handler as InternalRoute['handler'],
    });
  }

  remove<TKeys, TOldItem>(definition: DynamoDBRemoveRouteDefinition<TKeys, TOldItem>): this {
    return this.addRoute({
      filters: { ...definition.filters, eventName: 'REMOVE' },
      keysSchema: definition.keysSchema,
      oldImageSchema: definition.oldImageSchema,
      middleware: definition.middleware as InternalRoute['middleware'],
      handler: definition.handler as InternalRoute['handler'],
    });
  }

  private addRoute(definition: Omit<InternalRoute, 'middleware'> & { middleware?: InternalRoute['middleware'] }): this {
    this.routes.push({
      ...definition,
      middleware: definition.middleware ?? [],
    });
    return this;
  }

  async handleEvent(event: DynamoDBStreamEvent, context: Context): Promise<undefined | DynamoDBBatchResponse> {
    if (!this.batchItemFailures) {
      await this.processRecordsSequentially(event.Records, context);
      return;
    }

    const batchItemFailures = await this.processRecordsWithFailures(event.Records, context);
    if (batchItemFailures.length > 0) {
      return { batchItemFailures };
    }
  }

  private async processRecordsSequentially(records: DynamoDBRecord[], context: Context): Promise<void> {
    for (const record of records) {
      await this.processRecord(record, context);
    }
  }

  private async processRecordsWithFailures(
    records: DynamoDBRecord[],
    context: Context,
  ): Promise<DynamoDBBatchResponse['batchItemFailures']> {
    const failures: DynamoDBBatchResponse['batchItemFailures'] = [];

    for (const [idx, record] of records.entries()) {
      try {
        await this.processRecord(record, context);
      } catch (error) {
        logger.error(`Error processing DynamoDB record ${record.eventID}`, { error });
        for (const remaining of records.slice(idx)) {
          /* v8 ignore next -- @preserve - Guard is for TS. eventID is always present in AWS events but typed as optional */
          if (remaining.eventID) {
            failures.push({ itemIdentifier: remaining.eventID });
          }
        }
        break;
      }
    }
    return failures;
  }

  private async processRecord(record: DynamoDBRecord, context: Context): Promise<void> {
    const eventName = record.eventName;
    /* v8 ignore next -- @preserve - Guard is for TS. eventName is always present in AWS events but typed as optional */
    if (!eventName) {
      throw new Error(`Record missing eventName: ${record.eventID}`);
    }

    const streamViewType = record.dynamodb?.StreamViewType;
    /* v8 ignore next -- @preserve - Guard is for TS. Keys is always present in AWS events but typed as optional */
    const keys = record.dynamodb?.Keys ? unmarshall(record.dynamodb.Keys as UnmarshallInput) : {};
    const newImage = record.dynamodb?.NewImage ? unmarshall(record.dynamodb.NewImage as UnmarshallInput) : undefined;
    const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage as UnmarshallInput) : undefined;

    const route = await this.matchRoute(record, eventName, streamViewType, keys, newImage, oldImage);
    if (!route) {
      throw new Error(`No route matched for record ${record.eventID} from ${record.eventSourceARN}`);
    }

    const validatedKeys = await validateSchema(
      keys,
      route.keysSchema,
      `Image validation failed for Keys on record ${record.eventID}`,
    );

    const validatedNewImage = await validateSchema(
      newImage,
      route.newImageSchema,
      `Image validation failed for NewImage on record ${record.eventID}`,
    );

    const validatedOldImage = await validateSchema(
      oldImage,
      route.oldImageSchema,
      `Image validation failed for OldImage on record ${record.eventID}`,
    );

    const request: DynamoDBRequest = {
      keys: validatedKeys,
      newImage: validatedNewImage,
      oldImage: validatedOldImage,
      eventName,
      record,
      context,
    } as DynamoDBRequest;

    const allMiddleware = [...this.middleware, ...route.middleware];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(
    record: DynamoDBRecord,
    eventName: DynamoDBEventName,
    streamViewType: DynamoDBViewType | undefined,
    keys: Record<string, unknown>,
    newImage?: Record<string, unknown>, // TODO Make sure tests cover this
    oldImage?: Record<string, unknown>, // TODO Make sure tests cover this
  ): Promise<InternalRoute | undefined> {
    // record.dynamodb.Keys always comes in the same order, partition key first then sort key
    const [partitionKeyName, sortKeyName] = Object.keys(keys);

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.eventName) {
        const eventNames = Array.isArray(filters.eventName) ? filters.eventName : [filters.eventName];
        if (!eventNames.includes(eventName)) {
          continue;
        }
      }

      if (filters.eventSourceArn && record.eventSourceARN) {
        const eventSourceARNMatch = filterStringMatcher(record.eventSourceARN, filters.eventSourceArn);
        if (!eventSourceARNMatch) continue;
      }

      if (filters.streamViewType && streamViewType) {
        const { streamViewType: filterStreamViewType } = filters;
        const streamViewTypes = Array.isArray(filterStreamViewType) ? filterStreamViewType : [filterStreamViewType];
        if (!streamViewTypes.includes(streamViewType)) {
          continue;
        }
      }

      if (filters.partitionKey) {
        if (!partitionKeyName) continue;
        const partitionKey = keys[partitionKeyName];
        if (typeof partitionKey !== 'string' && typeof partitionKey !== 'number') continue;
        const partitionKeysMap = Array.isArray(filters.partitionKey) ? filters.partitionKey : [filters.partitionKey];
        if (typeof partitionKey === 'number') {
          if (!partitionKeysMap.includes(partitionKey)) continue;
        }
        const partitionKeyFilters = partitionKeysMap.map((key) => String(key));
        const resourceIdMatch = filterStringMatcher(String(partitionKey), partitionKeyFilters);
        if (!resourceIdMatch) continue;
      }

      if (filters.sortKey) {
        if (!sortKeyName) continue;
        const sortKey = keys[sortKeyName];
        if (typeof sortKey !== 'string' && typeof sortKey !== 'number') continue;

        const sortKeysMap = Array.isArray(filters.sortKey) ? filters.sortKey : [filters.sortKey];
        if (typeof sortKey === 'number') {
          if (!sortKeysMap.includes(sortKey)) continue;
        }
        const sortKeyFilters = sortKeysMap.map((key) => String(key));
        const resourceIdMatch = filterStringMatcher(String(sortKey), sortKeyFilters);
        if (!resourceIdMatch) continue;
      }

      if (filters.customFilter) {
        const match = await filters.customFilter({ eventName, streamViewType, record, keys, newImage, oldImage });
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createDynamoDBRouter(options?: DynamoDBRouterOptions): DynamoDBRouter {
  return new DynamoDBRouter(options);
}
