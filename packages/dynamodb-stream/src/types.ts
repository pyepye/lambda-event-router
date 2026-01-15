import type { Schema } from '@lambda-event-router/base';
import type { Context, DynamoDBRecord } from 'aws-lambda';

export type DynamoDBStreamEventName = 'INSERT' | 'MODIFY' | 'REMOVE';

export type DynamoDBStreamViewType = 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES';

interface DynamoDBStreamRequestBase<TKeys = Record<string, unknown>> {
  keys: TKeys;
  rawRecord: DynamoDBRecord;
  context: Context;
}

export interface DynamoDBStreamInsertRequest<TKeys = Record<string, unknown>, TNewItem = Record<string, unknown>>
  extends DynamoDBStreamRequestBase<TKeys> {
  eventName: 'INSERT';
  newImage: TNewItem;
  oldImage?: undefined;
}

export interface DynamoDBStreamModifyRequest<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> extends DynamoDBStreamRequestBase<TKeys> {
  eventName: 'MODIFY';
  newImage: TNewItem;
  oldImage: TOldItem;
}

export interface DynamoDBStreamRemoveRequest<TKeys = Record<string, unknown>, TOldItem = Record<string, unknown>>
  extends DynamoDBStreamRequestBase<TKeys> {
  eventName: 'REMOVE';
  newImage?: undefined;
  oldImage: TOldItem;
}

export type DynamoDBStreamRequest<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> =
  | DynamoDBStreamInsertRequest<TKeys, TNewItem>
  | DynamoDBStreamModifyRequest<TKeys, TNewItem, TOldItem>
  | DynamoDBStreamRemoveRequest<TKeys, TOldItem>;

export type DynamoDBStreamResponse = undefined;

type DynamoDBStreamRecordHandler<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> =
  | ((request: DynamoDBStreamRequest<TKeys, TNewItem, TOldItem>) => Promise<void>)
  | ((request: DynamoDBStreamInsertRequest<TKeys, TNewItem>) => Promise<void>)
  | ((request: DynamoDBStreamModifyRequest<TKeys, TNewItem, TOldItem>) => Promise<void>)
  | ((request: DynamoDBStreamRemoveRequest<TKeys, TOldItem>) => Promise<void>);

export interface DynamoDBStreamFilterInput {
  eventName: DynamoDBStreamEventName;
  streamViewType?: DynamoDBStreamViewType;
  rawRecord: DynamoDBRecord;
}

interface DynamoDBStreamFilters {
  eventNames?: DynamoDBStreamEventName[];
  eventSourceArns?: string[];
  streamViewTypes?: DynamoDBStreamViewType[];
  customFilter?: (input: DynamoDBStreamFilterInput) => boolean;
}

// Filters without eventNames for event-specific methods (insert, modify, remove)
interface DynamoDBStreamEventFilters {
  eventSourceArns?: string[];
  streamViewTypes?: DynamoDBStreamViewType[];
  customFilter?: (input: DynamoDBStreamFilterInput) => boolean;
}

export interface DynamoDBStreamInsertRouteDefinition<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
> {
  filters: DynamoDBStreamEventFilters;
  keysSchema?: Schema<TKeys>;
  newImageSchema?: Schema<TNewItem>;
  handler: (request: DynamoDBStreamInsertRequest<TKeys, TNewItem>) => Promise<void>;
}

export interface DynamoDBStreamModifyRouteDefinition<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> {
  filters: DynamoDBStreamEventFilters;
  keysSchema?: Schema<TKeys>;
  newImageSchema?: Schema<TNewItem>;
  oldImageSchema?: Schema<TOldItem>;
  handler: (request: DynamoDBStreamModifyRequest<TKeys, TNewItem, TOldItem>) => Promise<void>;
}

export interface DynamoDBStreamRemoveRouteDefinition<
  TKeys = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> {
  filters: DynamoDBStreamEventFilters;
  keysSchema?: Schema<TKeys>;
  oldImageSchema?: Schema<TOldItem>;
  handler: (request: DynamoDBStreamRemoveRequest<TKeys, TOldItem>) => Promise<void>;
}

export interface DynamoDBStreamRouteDefinition<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> {
  filters: DynamoDBStreamFilters;
  keysSchema?: Schema<TKeys>;
  newImageSchema?: Schema<TNewItem>;
  oldImageSchema?: Schema<TOldItem>;
  handler: DynamoDBStreamRecordHandler<TKeys, TNewItem, TOldItem>;
}

export interface DynamoDBStreamRouterOptions {
  batchItemFailures?: boolean;
}
