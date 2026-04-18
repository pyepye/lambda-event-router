import type { Middleware } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
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

export type DynamoDBMiddleware<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> = Middleware<DynamoDBRequest<TKeys, TNewItem, TOldItem>, void>;

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

export interface DynamoDBFilters {
  eventName?: DynamoDBEventName | DynamoDBEventName[];
  eventSourceArn?: DynamoDBRecord['eventSourceARN'] | DynamoDBRecord['eventSourceARN'][];
  streamViewType?: DynamoDBViewType | DynamoDBViewType[];
  customFilter?: (input: DynamoDBFilterInput) => boolean | Promise<boolean>;
}

export interface DynamoDBInsertRouteDefinition<TKeys = Record<string, unknown>, TNewItem = Record<string, unknown>> {
  filters: Omit<DynamoDBFilters, 'eventName'>;
  keysSchema?: StandardSchemaV1<unknown, TKeys>;
  newImageSchema?: StandardSchemaV1<unknown, TNewItem>;
  middleware?: DynamoDBMiddleware<TKeys, TNewItem>[];
  handler: (request: DynamoDBInsertRequest<TKeys, TNewItem>) => Promise<void>;
}

export interface DynamoDBModifyRouteDefinition<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> {
  filters: Omit<DynamoDBFilters, 'eventName'>;
  keysSchema?: StandardSchemaV1<unknown, TKeys>;
  newImageSchema?: StandardSchemaV1<unknown, TNewItem>;
  oldImageSchema?: StandardSchemaV1<unknown, TOldItem>;
  middleware?: DynamoDBMiddleware<TKeys, TNewItem, TOldItem>[];
  handler: (request: DynamoDBModifyRequest<TKeys, TNewItem, TOldItem>) => Promise<void>;
}

export interface DynamoDBRemoveRouteDefinition<TKeys = Record<string, unknown>, TOldItem = Record<string, unknown>> {
  filters: Omit<DynamoDBFilters, 'eventName'>;
  keysSchema?: StandardSchemaV1<unknown, TKeys>;
  oldImageSchema?: StandardSchemaV1<unknown, TOldItem>;
  middleware?: DynamoDBMiddleware<TKeys, Record<string, unknown>, TOldItem>[];
  handler: (request: DynamoDBRemoveRequest<TKeys, TOldItem>) => Promise<void>;
}

export interface DynamoDBRouteDefinition<
  TKeys = Record<string, unknown>,
  TNewItem = Record<string, unknown>,
  TOldItem = Record<string, unknown>,
> {
  filters: DynamoDBFilters;
  keysSchema?: StandardSchemaV1<unknown, TKeys>;
  newImageSchema?: StandardSchemaV1<unknown, TNewItem>;
  oldImageSchema?: StandardSchemaV1<unknown, TOldItem>;
  middleware?: DynamoDBMiddleware<TKeys, TNewItem, TOldItem>[];
  handler: DynamoDBRecordHandler<TKeys, TNewItem, TOldItem>;
}

export interface DynamoDBRouterOptions {
  batchItemFailures?: boolean;
  middleware?: DynamoDBMiddleware[];
}
