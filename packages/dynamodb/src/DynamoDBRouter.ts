import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context, DynamoDBBatchResponse, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import type { DynamoDBFilters, InternalRoute, RouteBuilder, RouteInput } from './routeTypes.js';
import type {
  DynamoDBEventName,
  DynamoDBInsertRouteDefinition,
  DynamoDBModifyRouteDefinition,
  DynamoDBRemoveRouteDefinition,
  DynamoDBRequest,
  DynamoDBRouteDefinition,
  DynamoDBRouterOptions,
  DynamoDBViewType,
} from './types.js';

type UnmarshallInput = Parameters<typeof unmarshall>[0];

export function defineRoute<
  TKeysSchema extends StandardSchemaV1 | undefined = undefined,
  TNewImageSchema extends StandardSchemaV1 | undefined = undefined,
  TOldImageSchema extends StandardSchemaV1 | undefined = undefined,
  const TEventNames extends readonly DynamoDBEventName[] | undefined = undefined,
  const TViewTypes extends readonly DynamoDBViewType[] | undefined = undefined,
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
      return {
        filters: config.filters as DynamoDBFilters,
        keysSchema: config.keysSchema as StandardSchemaV1<unknown, TKeys> | undefined,
        newImageSchema: config.newImageSchema as StandardSchemaV1<unknown, TNewItem> | undefined,
        oldImageSchema: config.oldImageSchema as StandardSchemaV1<unknown, TOldItem> | undefined,
        handler: handler as (request: DynamoDBRequest<TKeys, TNewItem, TOldItem>) => Promise<void>,
      };
    },
  };
}

export class DynamoDBRouter implements EventTypeRouter<DynamoDBStreamEvent, undefined | DynamoDBBatchResponse> {
  private routes: InternalRoute[] = [];
  private batchItemFailures: boolean;

  constructor(options?: DynamoDBRouterOptions) {
    this.batchItemFailures = options?.batchItemFailures ?? false;
  }

  canHandleEvent(event: unknown): event is DynamoDBStreamEvent {
    if (!isObject(event)) return false;
    if (!Array.isArray(event.Records)) return false;

    const firstRecord = event.Records[0];
    if (!isObject(firstRecord)) return false;

    return firstRecord.eventSource === 'aws:dynamodb';
  }

  route<TKeys, TNewItem, TOldItem>(definition: DynamoDBRouteDefinition<TKeys, TNewItem, TOldItem>): this {
    return this.addRoute(definition as InternalRoute);
  }

  insert<TKeys, TNewItem>(definition: DynamoDBInsertRouteDefinition<TKeys, TNewItem>): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, eventNames: ['INSERT'] },
    } as InternalRoute);
  }

  modify<TKeys, TNewItem, TOldItem>(definition: DynamoDBModifyRouteDefinition<TKeys, TNewItem, TOldItem>): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, eventNames: ['MODIFY'] },
    } as InternalRoute);
  }

  remove<TKeys, TOldItem>(definition: DynamoDBRemoveRouteDefinition<TKeys, TOldItem>): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, eventNames: ['REMOVE'] },
    } as InternalRoute);
  }

  private addRoute(definition: InternalRoute): this {
    this.routes.push(definition);
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
      } catch {
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
    const route = this.matchRoute(record, eventName, streamViewType);
    if (!route) {
      throw new Error(`No route matched for record ${record.eventID} from ${record.eventSourceARN}`);
    }

    /* v8 ignore next -- @preserve - Guard is for TS. Keys is always present in AWS events but typed as optional */
    const keys = record.dynamodb?.Keys ? unmarshall(record.dynamodb.Keys as UnmarshallInput) : {};
    const newImage = record.dynamodb?.NewImage ? unmarshall(record.dynamodb.NewImage as UnmarshallInput) : undefined;
    const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage as UnmarshallInput) : undefined;

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

    await route.handler(request);
  }

  private matchRoute(
    record: DynamoDBRecord,
    eventName: DynamoDBEventName,
    streamViewType: DynamoDBViewType | undefined,
  ): InternalRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.eventNames && !filters.eventNames.includes(eventName)) {
        return false;
      }

      if (filters.eventSourceArns && record.eventSourceARN) {
        if (!filters.eventSourceArns.includes(record.eventSourceARN)) {
          return false;
        }
      }

      if (filters.streamViewTypes && streamViewType) {
        if (!filters.streamViewTypes.includes(streamViewType)) {
          return false;
        }
      }

      if (filters.customFilter) {
        return filters.customFilter({ eventName, streamViewType, record });
      }

      return true;
    });
  }
}

export function createDynamoDBRouter(options?: DynamoDBRouterOptions): DynamoDBRouter {
  return new DynamoDBRouter(options);
}
