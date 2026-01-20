import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context, DynamoDBBatchResponse, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import type { DynamoDBStreamFilters, InternalRoute, RouteBuilder, RouteInput } from './routeTypes.js';
import type {
  DynamoDBStreamEventName,
  DynamoDBStreamInsertRouteDefinition,
  DynamoDBStreamModifyRouteDefinition,
  DynamoDBStreamRemoveRouteDefinition,
  DynamoDBStreamRequest,
  DynamoDBStreamRouteDefinition,
  DynamoDBStreamRouterOptions,
  DynamoDBStreamViewType,
} from './types.js';

type UnmarshallInput = Parameters<typeof unmarshall>[0];

export function defineRoute<
  TKeysSchema extends Schema<unknown> | undefined = undefined,
  TNewImageSchema extends Schema<unknown> | undefined = undefined,
  TOldImageSchema extends Schema<unknown> | undefined = undefined,
  const TEventNames extends readonly DynamoDBStreamEventName[] | undefined = undefined,
  const TViewTypes extends readonly DynamoDBStreamViewType[] | undefined = undefined,
  TKeys = TKeysSchema extends Schema<unknown> ? InferSchema<TKeysSchema> : Record<string, unknown>,
  TNewItem = TNewImageSchema extends Schema<unknown> ? InferSchema<TNewImageSchema> : Record<string, unknown>,
  TOldItem = TOldImageSchema extends Schema<unknown> ? InferSchema<TOldImageSchema> : Record<string, unknown>,
>(
  config: RouteInput<TKeysSchema, TNewImageSchema, TOldImageSchema, TEventNames, TViewTypes>,
): RouteBuilder<TKeys, TNewItem, TOldItem, TEventNames> {
  return {
    handle(handler): DynamoDBStreamRouteDefinition<TKeys, TNewItem, TOldItem> {
      return {
        filters: config.filters as DynamoDBStreamFilters,
        keysSchema: config.keysSchema as Schema<TKeys> | undefined,
        newImageSchema: config.newImageSchema as Schema<TNewItem> | undefined,
        oldImageSchema: config.oldImageSchema as Schema<TOldItem> | undefined,
        handler: handler as (request: DynamoDBStreamRequest<TKeys, TNewItem, TOldItem>) => Promise<void>,
      };
    },
  };
}

export class DynamoDBStreamRouter implements EventTypeRouter<DynamoDBStreamEvent, undefined | DynamoDBBatchResponse> {
  private routes: InternalRoute[] = [];
  private batchItemFailures: boolean;

  constructor(options?: DynamoDBStreamRouterOptions) {
    this.batchItemFailures = options?.batchItemFailures ?? false;
  }

  canHandleEvent(event: unknown): event is DynamoDBStreamEvent {
    if (!isObject(event)) return false;
    if (!Array.isArray(event.Records)) return false;

    const firstRecord = event.Records[0];
    if (!isObject(firstRecord)) return false;

    return firstRecord.eventSource === 'aws:dynamodb';
  }

  route<TKeys, TNewItem, TOldItem>(definition: DynamoDBStreamRouteDefinition<TKeys, TNewItem, TOldItem>): this {
    return this.addRoute(definition as InternalRoute);
  }

  insert<TKeys, TNewItem>(definition: DynamoDBStreamInsertRouteDefinition<TKeys, TNewItem>): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, eventNames: ['INSERT'] },
    } as InternalRoute);
  }

  modify<TKeys, TNewItem, TOldItem>(definition: DynamoDBStreamModifyRouteDefinition<TKeys, TNewItem, TOldItem>): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, eventNames: ['MODIFY'] },
    } as InternalRoute);
  }

  remove<TKeys, TOldItem>(definition: DynamoDBStreamRemoveRouteDefinition<TKeys, TOldItem>): this {
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

    for (const [i, record] of records.entries()) {
      try {
        await this.processRecord(record, context);
      } catch {
        for (const remaining of records.slice(i)) {
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
    const eventName = record.eventName as DynamoDBStreamEventName | undefined;
    if (!eventName) {
      throw new Error(`Record missing eventName: ${record.eventID}`);
    }

    const streamViewType = record.dynamodb?.StreamViewType as DynamoDBStreamViewType | undefined;
    const route = this.matchRoute(record, eventName, streamViewType);
    if (!route) {
      throw new Error(`No route matched for record ${record.eventID} from ${record.eventSourceARN}`);
    }

    const keys = record.dynamodb?.Keys ? unmarshall(record.dynamodb.Keys as UnmarshallInput) : {};
    const newImage = record.dynamodb?.NewImage ? unmarshall(record.dynamodb.NewImage as UnmarshallInput) : undefined;
    const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage as UnmarshallInput) : undefined;

    const validatedKeys = this.validateImage(keys, route.keysSchema, 'Keys', record.eventID);
    const validatedNewImage = this.validateImage(newImage, route.newImageSchema, 'NewImage', record.eventID);
    const validatedOldImage = this.validateImage(oldImage, route.oldImageSchema, 'OldImage', record.eventID);

    const request = {
      keys: validatedKeys,
      newImage: validatedNewImage,
      oldImage: validatedOldImage,
      eventName,
      record,
      context,
    } as DynamoDBStreamRequest;

    await route.handler(request);
  }

  private matchRoute(
    record: DynamoDBRecord,
    eventName: DynamoDBStreamEventName,
    streamViewType: DynamoDBStreamViewType | undefined,
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

  private validateImage<T extends Record<string, unknown> | undefined>(
    data: T,
    schema: Schema<unknown> | undefined,
    imageName: string,
    recordId: string | undefined,
  ): T {
    if (!schema || data === undefined) {
      return data;
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`${imageName} validation failed for record ${recordId}`);
    }
    return result.data as T;
  }
}

export function createDynamoDBStreamRouter(options?: DynamoDBStreamRouterOptions): DynamoDBStreamRouter {
  return new DynamoDBStreamRouter(options);
}
