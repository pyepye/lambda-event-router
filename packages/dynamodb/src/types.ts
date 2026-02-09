import type { Schema } from '@lambda-event-router/base';
import type { Context, DynamoDBRecord, StreamRecord } from 'aws-lambda';

// Derive event name type from aws-lambda (excludes undefined)
export type DynamoDBEventName = NonNullable<DynamoDBRecord['eventName']>;

// Derive stream view type from aws-lambda (excludes undefined)
export type DynamoDBViewType = NonNullable<StreamRecord['StreamViewType']>;

interface DynamoDBRequestBase<TKeys = Record<string, unknown>> {
  keys: TKeys;
  record: DynamoDBRecord;
  context: Context;
}

export interface DynamoDBInsertRequest<TKeys = Record<string, unknown>, TNewItem = Record<string, unknown>>
  extends DynamoDBRequestBase<TKeys> {
  eventName: 'INSERT';
  newImage: TNewItem;
  oldImage?: undefined;
}

export interface DynamoDBModifyRequest<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> extends DynamoDBRequestBase<TKeys> {
  eventName: 'MODIFY';
  newImage: TNewItem;
  oldImage: TOldItem;
}

export interface DynamoDBRemoveRequest<TKeys = Record<string, unknown>, TOldItem = Record<string, unknown>>
  extends DynamoDBRequestBase<TKeys> {
  eventName: 'REMOVE';
  newImage?: undefined;
  oldImage: TOldItem;
}

export type DynamoDBRequest<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> =
  | DynamoDBInsertRequest<TKeys, TNewItem>
  | DynamoDBModifyRequest<TKeys, TNewItem, TOldItem>
  | DynamoDBRemoveRequest<TKeys, TOldItem>;

export type DynamoDBResponse = undefined;

type DynamoDBRecordHandler<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> =
  | ((request: DynamoDBRequest<TKeys, TNewItem, TOldItem>) => Promise<void>)
  | ((request: DynamoDBInsertRequest<TKeys, TNewItem>) => Promise<void>)
  | ((request: DynamoDBModifyRequest<TKeys, TNewItem, TOldItem>) => Promise<void>)
  | ((request: DynamoDBRemoveRequest<TKeys, TOldItem>) => Promise<void>);

export interface DynamoDBFilterInput {
  eventName: DynamoDBEventName;
  streamViewType?: DynamoDBViewType;
  record: DynamoDBRecord;
}

interface DynamoDBFilters {
  eventNames?: DynamoDBEventName[];
  eventSourceArns?: DynamoDBRecord['eventSourceARN'][];
  streamViewTypes?: DynamoDBViewType[];
  customFilter?: (input: DynamoDBFilterInput) => boolean;
}

// Filters without eventNames for event-specific methods (insert, modify, remove)
interface DynamoDBEventFilters {
  eventSourceArns?: DynamoDBRecord['eventSourceARN'][];
  streamViewTypes?: DynamoDBViewType[];
  customFilter?: (input: DynamoDBFilterInput) => boolean;
}

export interface DynamoDBInsertRouteDefinition<TKeys = Record<string, unknown>, TNewItem = Record<string, unknown>> {
  filters: DynamoDBEventFilters;
  keysSchema?: Schema<TKeys>;
  newImageSchema?: Schema<TNewItem>;
  handler: (request: DynamoDBInsertRequest<TKeys, TNewItem>) => Promise<void>;
}

export interface DynamoDBModifyRouteDefinition<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> {
  filters: DynamoDBEventFilters;
  keysSchema?: Schema<TKeys>;
  newImageSchema?: Schema<TNewItem>;
  oldImageSchema?: Schema<TOldItem>;
  handler: (request: DynamoDBModifyRequest<TKeys, TNewItem, TOldItem>) => Promise<void>;
}

export interface DynamoDBRemoveRouteDefinition<TKeys = Record<string, unknown>, TOldItem = Record<string, unknown>> {
  filters: DynamoDBEventFilters;
  keysSchema?: Schema<TKeys>;
  oldImageSchema?: Schema<TOldItem>;
  handler: (request: DynamoDBRemoveRequest<TKeys, TOldItem>) => Promise<void>;
}

export interface DynamoDBRouteDefinition<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> {
  filters: DynamoDBFilters;
  keysSchema?: Schema<TKeys>;
  newImageSchema?: Schema<TNewItem>;
  oldImageSchema?: Schema<TOldItem>;
  handler: DynamoDBRecordHandler<TKeys, TNewItem, TOldItem>;
}

export interface DynamoDBRouterOptions {
  batchItemFailures?: boolean;
}
