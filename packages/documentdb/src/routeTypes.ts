import type { Middleware } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
  DocumentDBEventEntry,
  DocumentDBFilterInput,
  DocumentDBFullDocumentBeforeChangeOption,
  DocumentDBFullDocumentOption,
  DocumentDBMiddleware,
  DocumentDBOperationType,
  DocumentDBRequest,
  DocumentDBRouteDefinition,
  DocumentDBUpdateDescription,
} from './types.js';

export interface DocumentDBFilters {
  operationTypes?: DocumentDBOperationType[];
  eventSourceArns?: string[];
  databases?: string[];
  collections?: string[];
  fullDocument?: DocumentDBFullDocumentOption[];
  fullDocumentBeforeChange?: DocumentDBFullDocumentBeforeChangeOption[];
  customFilter?: (input: DocumentDBFilterInput) => boolean;
}

export interface InternalRequest {
  operationType: DocumentDBOperationType;
  documentKey: Record<string, unknown>;
  fullDocument: Record<string, unknown> | undefined;
  updateDescription: DocumentDBUpdateDescription | undefined;
  fullDocumentBeforeChange: Record<string, unknown> | undefined;
  changeEvent: unknown;
  entry: DocumentDBEventEntry;
  context: unknown;
}

export interface InternalRoute {
  filters: DocumentDBFilters;
  documentKeySchema?: StandardSchemaV1;
  fullDocumentSchema?: StandardSchemaV1;
  fullDocumentBeforeChangeSchema?: StandardSchemaV1;
  middleware: Middleware<InternalRequest, void>[];
  handler: (request: InternalRequest) => Promise<void>;
}

export interface RouteInputFilters {
  operationTypes?: readonly DocumentDBOperationType[];
  eventSourceArns?: readonly string[];
  databases?: readonly string[];
  collections?: readonly string[];
  fullDocument?: readonly DocumentDBFullDocumentOption[];
  fullDocumentBeforeChange?: readonly DocumentDBFullDocumentBeforeChangeOption[];
  customFilter?: (input: DocumentDBFilterInput) => boolean;
}

// Operations that always have fullDocument (insert and replace)
type OperationWithFullDocument = 'insert' | 'replace';

// Operations that never have fullDocument (delete)
type OperationWithoutFullDocument = 'delete';

// Operations that always have updateDescription (update only)
type OperationWithUpdateDescription = 'update';

// Operations that never have updateDescription (insert, replace, delete)
type OperationWithoutUpdateDescription = 'insert' | 'replace' | 'delete';

// Operations that never have fullDocumentBeforeChange (insert)
type OperationWithoutFullDocumentBeforeChange = 'insert';

// Check if all operations in the array have fullDocument
type AllHaveFullDocument<T extends readonly DocumentDBOperationType[]> = T[number] extends OperationWithFullDocument
  ? true
  : false;

// Check if none of the operations have fullDocument (all are delete)
type NoneHaveFullDocument<T extends readonly DocumentDBOperationType[]> = T[number] extends OperationWithoutFullDocument
  ? true
  : false;

// Check if all operations have updateDescription (all are update)
type AllHaveUpdateDescription<T extends readonly DocumentDBOperationType[]> =
  T[number] extends OperationWithUpdateDescription ? true : false;

// Check if none of the operations have updateDescription
type NoneHaveUpdateDescription<T extends readonly DocumentDBOperationType[]> =
  T[number] extends OperationWithoutUpdateDescription ? true : false;

// Check if none of the operations have fullDocumentBeforeChange (all are insert)
type NoneHaveFullDocumentBeforeChange<T extends readonly DocumentDBOperationType[]> =
  T[number] extends OperationWithoutFullDocumentBeforeChange ? true : false;

// Check if filter declares fullDocument with non-default values
type FullDocumentFilterDeclared<T extends readonly DocumentDBFullDocumentOption[] | undefined> =
  T extends readonly DocumentDBFullDocumentOption[]
    ? Exclude<T[number], 'default'> extends never
      ? false
      : true
    : false;

// Check if filter declares fullDocumentBeforeChange with non-off values
type FullDocumentBeforeChangeFilterDeclared<T extends readonly DocumentDBFullDocumentBeforeChangeOption[] | undefined> =
  T extends readonly DocumentDBFullDocumentBeforeChangeOption[]
    ? Exclude<T[number], 'off'> extends never
      ? false
      : true
    : false;

// Prevent fullDocumentSchema when all operations are delete
type FullDocumentSchemaOption<
  TOperationTypes extends readonly DocumentDBOperationType[] | undefined,
  TFullDocumentSchema extends StandardSchemaV1 | undefined,
> = TOperationTypes extends readonly DocumentDBOperationType[]
  ? NoneHaveFullDocument<TOperationTypes> extends true
    ? { fullDocumentSchema?: never }
    : { fullDocumentSchema?: TFullDocumentSchema }
  : { fullDocumentSchema?: TFullDocumentSchema };

// Prevent fullDocumentBeforeChangeSchema when all operations are insert
type FullDocumentBeforeChangeSchemaOption<
  TOperationTypes extends readonly DocumentDBOperationType[] | undefined,
  TFullDocumentBeforeChangeSchema extends StandardSchemaV1 | undefined,
> = TOperationTypes extends readonly DocumentDBOperationType[]
  ? NoneHaveFullDocumentBeforeChange<TOperationTypes> extends true
    ? { fullDocumentBeforeChangeSchema?: never }
    : { fullDocumentBeforeChangeSchema?: TFullDocumentBeforeChangeSchema }
  : { fullDocumentBeforeChangeSchema?: TFullDocumentBeforeChangeSchema };

// Determine fullDocument type based on operation types and filter config
type FullDocumentType<
  TOpTypes extends readonly DocumentDBOperationType[],
  TFilterOpts extends readonly DocumentDBFullDocumentOption[] | undefined,
  TFullDoc,
> =
  AllHaveFullDocument<TOpTypes> extends true
    ? TFullDoc
    : NoneHaveFullDocument<TOpTypes> extends true
      ? undefined
      : FullDocumentFilterDeclared<TFilterOpts> extends true
        ? TFullDoc
        : TFullDoc | undefined;

// Determine updateDescription type based on operation types
type UpdateDescriptionType<TOpTypes extends readonly DocumentDBOperationType[]> =
  AllHaveUpdateDescription<TOpTypes> extends true
    ? { updatedFields?: Record<string, unknown>; removedFields?: string[] }
    : NoneHaveUpdateDescription<TOpTypes> extends true
      ? undefined
      : { updatedFields?: Record<string, unknown>; removedFields?: string[] } | undefined;

// Determine fullDocumentBeforeChange type based on operation types and filter config
type FullDocumentBeforeChangeType<
  TOpTypes extends readonly DocumentDBOperationType[],
  TFilterOpts extends readonly DocumentDBFullDocumentBeforeChangeOption[] | undefined,
  TBeforeDoc,
> =
  NoneHaveFullDocumentBeforeChange<TOpTypes> extends true
    ? undefined
    : FullDocumentBeforeChangeFilterDeclared<TFilterOpts> extends true
      ? TBeforeDoc
      : TBeforeDoc | undefined;

// Maps filter config to handler request type
export type FiltersToRequest<
  TFilters extends RouteInputFilters,
  TDocumentKey,
  TFullDocument,
  TFullDocumentBeforeChange,
> = TFilters['operationTypes'] extends readonly DocumentDBOperationType[]
  ? {
      operationType: TFilters['operationTypes'][number];
      documentKey: TDocumentKey;
      fullDocument: FullDocumentType<TFilters['operationTypes'], TFilters['fullDocument'], TFullDocument>;
      updateDescription: UpdateDescriptionType<TFilters['operationTypes']>;
      fullDocumentBeforeChange: FullDocumentBeforeChangeType<
        TFilters['operationTypes'],
        TFilters['fullDocumentBeforeChange'],
        TFullDocumentBeforeChange
      >;
      changeEvent: unknown;
      context: unknown;
    }
  : DocumentDBRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>;

export type RouteInput<
  TDocumentKeySchema extends StandardSchemaV1 | undefined = undefined,
  TFullDocumentSchema extends StandardSchemaV1 | undefined = undefined,
  TFullDocumentBeforeChangeSchema extends StandardSchemaV1 | undefined = undefined,
  TFilters extends RouteInputFilters = RouteInputFilters,
> = {
  filters: TFilters;
  documentKeySchema?: TDocumentKeySchema;
  middleware?: DocumentDBMiddleware[];
} & FullDocumentSchemaOption<TFilters['operationTypes'], TFullDocumentSchema> &
  FullDocumentBeforeChangeSchemaOption<TFilters['operationTypes'], TFullDocumentBeforeChangeSchema>;

export interface RouteBuilder<
  TDocumentKey,
  TFullDocument,
  TFullDocumentBeforeChange,
  TFilters extends RouteInputFilters,
> {
  handle(
    handler: (
      request: FiltersToRequest<TFilters, TDocumentKey, TFullDocument, TFullDocumentBeforeChange>,
    ) => Promise<void>,
  ): DocumentDBRouteDefinition<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>;
}
