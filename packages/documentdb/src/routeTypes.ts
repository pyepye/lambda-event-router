import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { Middleware } from '@lambda-event-router/base';

import type {
  DocumentDBFilters,
  DocumentDBFullDocumentBeforeChangeOption,
  DocumentDBFullDocumentOption,
  DocumentDBMiddleware,
  DocumentDBOperationType,
  DocumentDBRequest,
  DocumentDBRouteDefinition,
} from './types.js';

// Ops whose change events can carry fullDocument (delete is the only op that never has it)
type OperationsWithFullDocument = 'insert' | 'replace' | 'update';

// Ops whose change events can carry fullDocumentBeforeChange (insert is the only op that never has it)
type OperationsWithFullDocumentBeforeChange = 'update' | 'replace' | 'delete';

// Normalize a filter operationType (single value or array) to its element union
type OperationTypeUnion<T> = T extends readonly DocumentDBOperationType[]
  ? T[number]
  : T extends DocumentDBOperationType
    ? T
    : never;

// The filter declares fullDocument when at least one value is a non-default change stream option
type FullDocumentFilterDeclared<T> = T extends DocumentDBFullDocumentOption | readonly DocumentDBFullDocumentOption[]
  ? [Exclude<T extends readonly unknown[] ? T[number] : T, 'default'>] extends [never]
    ? false
    : true
  : false;

// The filter declares fullDocumentBeforeChange when at least one value is a non-off change stream option
type FullDocumentBeforeChangeFilterDeclared<T> = T extends
  | DocumentDBFullDocumentBeforeChangeOption
  | readonly DocumentDBFullDocumentBeforeChangeOption[]
  ? [Exclude<T extends readonly unknown[] ? T[number] : T, 'off'>] extends [never]
    ? false
    : true
  : false;

// Only allow schema options for fields that at least one filtered op can carry
type FullDocumentSchemaOption<
  TOp extends DocumentDBFilters['operationType'],
  TSchema extends StandardSchemaV1 | undefined,
> = TOp extends DocumentDBOperationType | readonly DocumentDBOperationType[]
  ? [Extract<OperationTypeUnion<TOp>, OperationsWithFullDocument>] extends [never]
    ? { fullDocumentSchema?: never }
    : { fullDocumentSchema?: TSchema }
  : { fullDocumentSchema?: TSchema };

type FullDocumentBeforeChangeSchemaOption<
  TOp extends DocumentDBFilters['operationType'],
  TSchema extends StandardSchemaV1 | undefined,
> = TOp extends DocumentDBOperationType | readonly DocumentDBOperationType[]
  ? [Extract<OperationTypeUnion<TOp>, OperationsWithFullDocumentBeforeChange>] extends [never]
    ? { fullDocumentBeforeChangeSchema?: never }
    : { fullDocumentBeforeChangeSchema?: TSchema }
  : { fullDocumentBeforeChangeSchema?: TSchema };

// When the filter declares that the change stream is configured to populate a field,
// overlay it as required so the handler doesn't need to narrow it
type FilterOverrides<
  TFilters extends DocumentDBFilters,
  TFullDocument,
  TFullDocumentBeforeChange,
> = (FullDocumentFilterDeclared<TFilters['fullDocument']> extends true ? { fullDocument: TFullDocument } : unknown) &
  (FullDocumentBeforeChangeFilterDeclared<TFilters['fullDocumentBeforeChange']> extends true
    ? { fullDocumentBeforeChange: TFullDocumentBeforeChange }
    : unknown);

// Narrow DocumentDBRequest to the branches matching the filtered operationType(s),
// then overlay any required fields declared by the filter
export type FiltersToRequest<
  TFilters extends DocumentDBFilters,
  TDocumentKey,
  TFullDocument,
  TFullDocumentBeforeChange,
> = TFilters['operationType'] extends DocumentDBOperationType | readonly DocumentDBOperationType[]
  ? Extract<
      DocumentDBRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>,
      { operationType: OperationTypeUnion<TFilters['operationType']> }
    > &
      FilterOverrides<TFilters, TFullDocument, TFullDocumentBeforeChange>
  : DocumentDBRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>;

export type RouteInput<
  TDocumentKeySchema extends StandardSchemaV1 | undefined = undefined,
  TFullDocumentSchema extends StandardSchemaV1 | undefined = undefined,
  TFullDocumentBeforeChangeSchema extends StandardSchemaV1 | undefined = undefined,
  TFilters extends DocumentDBFilters = DocumentDBFilters,
> = {
  filters: TFilters;
  documentKeySchema?: TDocumentKeySchema;
  middleware?: DocumentDBMiddleware[];
} & FullDocumentSchemaOption<TFilters['operationType'], TFullDocumentSchema> &
  FullDocumentBeforeChangeSchemaOption<TFilters['operationType'], TFullDocumentBeforeChangeSchema>;

export interface RouteBuilder<
  TDocumentKey,
  TFullDocument,
  TFullDocumentBeforeChange,
  TFilters extends DocumentDBFilters,
> {
  handle(
    handler: (
      request: FiltersToRequest<TFilters, TDocumentKey, TFullDocument, TFullDocumentBeforeChange>,
    ) => Promise<void>,
  ): DocumentDBRouteDefinition<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>;
}

export interface InternalRoute {
  filters: DocumentDBFilters;
  documentKeySchema?: StandardSchemaV1;
  fullDocumentSchema?: StandardSchemaV1;
  fullDocumentBeforeChangeSchema?: StandardSchemaV1;
  middleware: Middleware<DocumentDBRequest, void>[];
  handler: (request: DocumentDBRequest) => Promise<void>;
}
