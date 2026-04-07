import type { Middleware } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { DynamoDBRecord } from 'aws-lambda';
import type {
  DynamoDBEventName,
  DynamoDBFilterInput,
  DynamoDBRequest,
  DynamoDBRouteDefinition,
  DynamoDBViewType,
} from './types.js';

export interface DynamoDBFilters {
  eventNames?: DynamoDBEventName[];
  eventSourceArns?: DynamoDBRecord['eventSourceARN'][];
  streamViewTypes?: DynamoDBViewType[];
  customFilter?: (input: DynamoDBFilterInput) => boolean;
}

export interface InternalRoute {
  filters: DynamoDBFilters;
  keysSchema?: StandardSchemaV1;
  newImageSchema?: StandardSchemaV1;
  oldImageSchema?: StandardSchemaV1;
  middleware: Middleware<DynamoDBRequest, void>[];
  handler: (request: DynamoDBRequest) => Promise<void>;
}

export interface RouteInputFilters<
  TEventNames extends readonly DynamoDBEventName[] | undefined = undefined,
  TViewTypes extends readonly DynamoDBViewType[] | undefined = undefined,
> {
  eventNames?: TEventNames;
  eventSourceArns?: readonly DynamoDBRecord['eventSourceARN'][];
  streamViewTypes?: TViewTypes;
  customFilter?: (input: DynamoDBFilterInput) => boolean;
}

// Events that have newImage / oldImage
type EventWithNewImage = 'INSERT' | 'MODIFY';
type EventWithOldImage = 'MODIFY' | 'REMOVE';

// Events that don't have newImage / oldImage
type EventWithoutNewImage = 'REMOVE';
type EventWithoutOldImage = 'INSERT';

// Check if all events in the array have newImage
type AllHaveNewImage<T extends readonly DynamoDBEventName[]> = T[number] extends EventWithNewImage ? true : false;

// Check if all events in the array have oldImage
type AllHaveOldImage<T extends readonly DynamoDBEventName[]> = T[number] extends EventWithOldImage ? true : false;

// Check if no events in the array have newImage (all are REMOVE)
type NoneHaveNewImage<T extends readonly DynamoDBEventName[]> = T[number] extends EventWithoutNewImage ? true : false;

// Check if no events in the array have oldImage (all are INSERT)
type NoneHaveOldImage<T extends readonly DynamoDBEventName[]> = T[number] extends EventWithoutOldImage ? true : false;

// Conditionally allow newImageSchema only if events can have newImage
type NewImageSchemaOption<
  TEventNames extends readonly DynamoDBEventName[] | undefined,
  TNewImageSchema extends StandardSchemaV1 | undefined,
> = TEventNames extends readonly DynamoDBEventName[]
  ? NoneHaveNewImage<TEventNames> extends true
    ? { newImageSchema?: never }
    : { newImageSchema?: TNewImageSchema }
  : { newImageSchema?: TNewImageSchema };

// Conditionally allow oldImageSchema only if events can have oldImage
type OldImageSchemaOption<
  TEventNames extends readonly DynamoDBEventName[] | undefined,
  TOldImageSchema extends StandardSchemaV1 | undefined,
> = TEventNames extends readonly DynamoDBEventName[]
  ? NoneHaveOldImage<TEventNames> extends true
    ? { oldImageSchema?: never }
    : { oldImageSchema?: TOldImageSchema }
  : { oldImageSchema?: TOldImageSchema };

export type RouteInput<
  TKeysSchema extends StandardSchemaV1 | undefined = undefined,
  TNewImageSchema extends StandardSchemaV1 | undefined = undefined,
  TOldImageSchema extends StandardSchemaV1 | undefined = undefined,
  TEventNames extends readonly DynamoDBEventName[] | undefined = undefined,
  TViewTypes extends readonly DynamoDBViewType[] | undefined = undefined,
> = {
  filters: RouteInputFilters<TEventNames, TViewTypes>;
  keysSchema?: TKeysSchema;
  middleware?: Middleware<DynamoDBRequest, void>[];
} & NewImageSchemaOption<TEventNames, TNewImageSchema> &
  OldImageSchemaOption<TEventNames, TOldImageSchema>;

// Determine newImage type based on event names
type NewImageType<T extends readonly DynamoDBEventName[], TNewItem> =
  AllHaveNewImage<T> extends true ? TNewItem : NoneHaveNewImage<T> extends true ? undefined : TNewItem | undefined;

// Determine oldImage type based on event names
type OldImageType<T extends readonly DynamoDBEventName[], TOldItem> =
  AllHaveOldImage<T> extends true ? TOldItem : NoneHaveOldImage<T> extends true ? undefined : TOldItem | undefined;

// Internal type - maps filters to request type
export type FiltersToRequest<
  TEventNames extends readonly DynamoDBEventName[] | undefined,
  TKeys,
  TNewItem,
  TOldItem,
> = TEventNames extends readonly DynamoDBEventName[]
  ? {
      eventName: TEventNames[number];
      keys: TKeys;
      newImage: NewImageType<TEventNames, TNewItem>;
      oldImage: OldImageType<TEventNames, TOldItem>;
      record: unknown;
      context: unknown;
    }
  : DynamoDBRequest<TKeys, TNewItem, TOldItem>;

export interface RouteBuilder<TKeys, TNewItem, TOldItem, TEventNames extends readonly DynamoDBEventName[] | undefined> {
  handle(
    handler: (request: FiltersToRequest<TEventNames, TKeys, TNewItem, TOldItem>) => Promise<void>,
  ): DynamoDBRouteDefinition<TKeys, TNewItem, TOldItem>;
}
