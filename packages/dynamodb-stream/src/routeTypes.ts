import type { Schema } from '@lambda-event-router/base';
import type {
  DynamoDBStreamEventName,
  DynamoDBStreamFilterInput,
  DynamoDBStreamRequest,
  DynamoDBStreamRouteDefinition,
  DynamoDBStreamViewType,
} from './types.js';

export interface DynamoDBStreamFilters {
  eventNames?: DynamoDBStreamEventName[];
  eventSourceArns?: string[];
  streamViewTypes?: DynamoDBStreamViewType[];
  customFilter?: (input: DynamoDBStreamFilterInput) => boolean;
}

export interface InternalRoute {
  filters: DynamoDBStreamFilters;
  keysSchema?: Schema<unknown>;
  newImageSchema?: Schema<unknown>;
  oldImageSchema?: Schema<unknown>;
  handler: (request: DynamoDBStreamRequest) => Promise<void>;
}

export interface RouteInputFilters<
  TEventNames extends readonly DynamoDBStreamEventName[] | undefined = undefined,
  TViewTypes extends readonly DynamoDBStreamViewType[] | undefined = undefined,
> {
  eventNames?: TEventNames;
  eventSourceArns?: readonly string[];
  streamViewTypes?: TViewTypes;
  customFilter?: (input: DynamoDBStreamFilterInput) => boolean;
}

// Events that have newImage / oldImage
type EventWithNewImage = 'INSERT' | 'MODIFY';
type EventWithOldImage = 'MODIFY' | 'REMOVE';

// Events that don't have newImage / oldImage
type EventWithoutNewImage = 'REMOVE';
type EventWithoutOldImage = 'INSERT';

// Check if all events in the array have newImage
type AllHaveNewImage<T extends readonly DynamoDBStreamEventName[]> = T[number] extends EventWithNewImage ? true : false;

// Check if all events in the array have oldImage
type AllHaveOldImage<T extends readonly DynamoDBStreamEventName[]> = T[number] extends EventWithOldImage ? true : false;

// Check if no events in the array have newImage (all are REMOVE)
type NoneHaveNewImage<T extends readonly DynamoDBStreamEventName[]> = T[number] extends EventWithoutNewImage
  ? true
  : false;

// Check if no events in the array have oldImage (all are INSERT)
type NoneHaveOldImage<T extends readonly DynamoDBStreamEventName[]> = T[number] extends EventWithoutOldImage
  ? true
  : false;

// Conditionally allow newImageSchema only if events can have newImage
type NewImageSchemaOption<
  TEventNames extends readonly DynamoDBStreamEventName[] | undefined,
  TNewImageSchema extends Schema<unknown> | undefined,
> = TEventNames extends readonly DynamoDBStreamEventName[]
  ? NoneHaveNewImage<TEventNames> extends true
    ? { newImageSchema?: never }
    : { newImageSchema?: TNewImageSchema }
  : { newImageSchema?: TNewImageSchema };

// Conditionally allow oldImageSchema only if events can have oldImage
type OldImageSchemaOption<
  TEventNames extends readonly DynamoDBStreamEventName[] | undefined,
  TOldImageSchema extends Schema<unknown> | undefined,
> = TEventNames extends readonly DynamoDBStreamEventName[]
  ? NoneHaveOldImage<TEventNames> extends true
    ? { oldImageSchema?: never }
    : { oldImageSchema?: TOldImageSchema }
  : { oldImageSchema?: TOldImageSchema };

export type RouteInput<
  TKeysSchema extends Schema<unknown> | undefined = undefined,
  TNewImageSchema extends Schema<unknown> | undefined = undefined,
  TOldImageSchema extends Schema<unknown> | undefined = undefined,
  TEventNames extends readonly DynamoDBStreamEventName[] | undefined = undefined,
  TViewTypes extends readonly DynamoDBStreamViewType[] | undefined = undefined,
> = {
  filters: RouteInputFilters<TEventNames, TViewTypes>;
  keysSchema?: TKeysSchema;
} & NewImageSchemaOption<TEventNames, TNewImageSchema> &
  OldImageSchemaOption<TEventNames, TOldImageSchema>;

// Determine newImage type based on event names
type NewImageType<T extends readonly DynamoDBStreamEventName[], TNewItem> = AllHaveNewImage<T> extends true
  ? TNewItem
  : NoneHaveNewImage<T> extends true
    ? undefined
    : TNewItem | undefined;

// Determine oldImage type based on event names
type OldImageType<T extends readonly DynamoDBStreamEventName[], TOldItem> = AllHaveOldImage<T> extends true
  ? TOldItem
  : NoneHaveOldImage<T> extends true
    ? undefined
    : TOldItem | undefined;

// Internal type - maps filters to request type
export type FiltersToRequest<
  TEventNames extends readonly DynamoDBStreamEventName[] | undefined,
  TKeys,
  TNewItem,
  TOldItem,
> = TEventNames extends readonly DynamoDBStreamEventName[]
  ? {
      eventName: TEventNames[number];
      keys: TKeys;
      newImage: NewImageType<TEventNames, TNewItem>;
      oldImage: OldImageType<TEventNames, TOldItem>;
      rawRecord: unknown;
      context: unknown;
    }
  : DynamoDBStreamRequest<TKeys, TNewItem, TOldItem>;

export interface RouteBuilder<
  TKeys,
  TNewItem,
  TOldItem,
  TEventNames extends readonly DynamoDBStreamEventName[] | undefined,
> {
  handle(
    handler: (request: FiltersToRequest<TEventNames, TKeys, TNewItem, TOldItem>) => Promise<void>,
  ): DynamoDBStreamRouteDefinition<TKeys, TNewItem, TOldItem>;
}
