import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

// DocumentDB operation types (lowercase, unlike DynamoDB's uppercase)
export type DocumentDBOperationType = 'insert' | 'update' | 'replace' | 'delete';

export type DocumentDBFullDocumentOption = 'default' | 'updateLookup' | 'whenAvailable' | 'required';
export type DocumentDBFullDocumentBeforeChangeOption = 'off' | 'whenAvailable' | 'required';

export interface DocumentDBUpdateDescription {
  updatedFields?: Record<string, unknown>;
  removedFields?: string[];
}

export interface DocumentDBChangeEvent {
  _id: unknown;
  clusterTime: unknown;
  operationType: DocumentDBOperationType;
  ns: { db: string; coll: string };
  documentKey: unknown;
  fullDocument?: unknown;
  updateDescription?: DocumentDBUpdateDescription;
  fullDocumentBeforeChange?: unknown;
}

export interface DocumentDBEventEntry {
  event: DocumentDBChangeEvent;
}

export interface DocumentDBEvent {
  eventSourceArn: string;
  eventSource: 'aws:docdb';
  events: DocumentDBEventEntry[];
}

// Request types - one per operation, with type-level field availability

interface DocumentDBRequestBase<TDocumentKey = Record<string, unknown>> {
  documentKey: TDocumentKey;
  changeEvent: DocumentDBChangeEvent;
  entry: DocumentDBEventEntry;
  context: Context;
}

export interface DocumentDBInsertRequest<
  TDocumentKey = Record<string, unknown>,
  TFullDocument = Record<string, unknown>,
> extends DocumentDBRequestBase<TDocumentKey> {
  operationType: 'insert';
  fullDocument: TFullDocument;
  updateDescription?: undefined;
  fullDocumentBeforeChange?: undefined;
}

export interface DocumentDBUpdateRequest<
  TDocumentKey = Record<string, unknown>,
  TFullDocument = Record<string, unknown>,
  TFullDocumentBeforeChange = Record<string, unknown>,
> extends DocumentDBRequestBase<TDocumentKey> {
  operationType: 'update';
  fullDocument?: TFullDocument;
  updateDescription: DocumentDBUpdateDescription;
  fullDocumentBeforeChange?: TFullDocumentBeforeChange;
}

export interface DocumentDBReplaceRequest<
  TDocumentKey = Record<string, unknown>,
  TFullDocument = Record<string, unknown>,
  TFullDocumentBeforeChange = Record<string, unknown>,
> extends DocumentDBRequestBase<TDocumentKey> {
  operationType: 'replace';
  fullDocument: TFullDocument;
  updateDescription?: undefined;
  fullDocumentBeforeChange?: TFullDocumentBeforeChange;
}

export interface DocumentDBDeleteRequest<
  TDocumentKey = Record<string, unknown>,
  TFullDocumentBeforeChange = Record<string, unknown>,
> extends DocumentDBRequestBase<TDocumentKey> {
  operationType: 'delete';
  fullDocument?: undefined;
  updateDescription?: undefined;
  fullDocumentBeforeChange?: TFullDocumentBeforeChange;
}

export type DocumentDBRequest<
  TDocumentKey = Record<string, unknown>,
  TFullDocument = Record<string, unknown>,
  TFullDocumentBeforeChange = Record<string, unknown>,
> =
  | DocumentDBInsertRequest<TDocumentKey, TFullDocument>
  | DocumentDBUpdateRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>
  | DocumentDBReplaceRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>
  | DocumentDBDeleteRequest<TDocumentKey, TFullDocumentBeforeChange>;

export type DocumentDBResponse = undefined;

export type DocumentDBMiddleware<
  TDocumentKey = Record<string, unknown>,
  TFullDocument = Record<string, unknown>,
  TFullDocumentBeforeChange = Record<string, unknown>,
> = Middleware<DocumentDBRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>, void>;

export type DocumentDBRecordHandler<
  TDocumentKey = Record<string, unknown>,
  TFullDocument = Record<string, unknown>,
  TFullDocumentBeforeChange = Record<string, unknown>,
> =
  | ((request: DocumentDBRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>) => Promise<void>)
  | ((request: DocumentDBInsertRequest<TDocumentKey, TFullDocument>) => Promise<void>)
  | ((request: DocumentDBUpdateRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>) => Promise<void>)
  | ((request: DocumentDBReplaceRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>) => Promise<void>)
  | ((request: DocumentDBDeleteRequest<TDocumentKey, TFullDocumentBeforeChange>) => Promise<void>);

// Filter types

export interface DocumentDBFilterInput {
  operationType: DocumentDBOperationType;
  ns: { db: string; coll: string };
  event: DocumentDBChangeEvent;
}

export interface DocumentDBFilters {
  operationType?: DocumentDBOperationType | readonly DocumentDBOperationType[];
  eventSourceArn?: FilterStringMatcher;
  database?: FilterStringMatcher;
  collection?: FilterStringMatcher;
  fullDocument?: DocumentDBFullDocumentOption | readonly DocumentDBFullDocumentOption[];
  fullDocumentBeforeChange?:
    | DocumentDBFullDocumentBeforeChangeOption
    | readonly DocumentDBFullDocumentBeforeChangeOption[];
  custom?: (input: DocumentDBFilterInput) => boolean | Promise<boolean>;
}

// Route definition types - one per operation + generic

export interface DocumentDBInsertRouteDefinition<
  TDocumentKey = Record<string, unknown>,
  TFullDocument = Record<string, unknown>,
> {
  filters: Omit<DocumentDBFilters, 'operationType'>;
  documentKeySchema?: StandardSchemaV1<unknown, TDocumentKey>;
  fullDocumentSchema?: StandardSchemaV1<unknown, TFullDocument>;
  middleware?: DocumentDBMiddleware<TDocumentKey, TFullDocument>[];
  handler: (request: DocumentDBInsertRequest<TDocumentKey, TFullDocument>) => Promise<void>;
}

export interface DocumentDBUpdateRouteDefinition<
  TDocumentKey = Record<string, unknown>,
  TFullDocument = Record<string, unknown>,
  TFullDocumentBeforeChange = Record<string, unknown>,
> {
  filters: Omit<DocumentDBFilters, 'operationType'>;
  documentKeySchema?: StandardSchemaV1<unknown, TDocumentKey>;
  fullDocumentSchema?: StandardSchemaV1<unknown, TFullDocument>;
  fullDocumentBeforeChangeSchema?: StandardSchemaV1<unknown, TFullDocumentBeforeChange>;
  middleware?: DocumentDBMiddleware<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>[];
  handler: (request: DocumentDBUpdateRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>) => Promise<void>;
}

export interface DocumentDBReplaceRouteDefinition<
  TDocumentKey = Record<string, unknown>,
  TFullDocument = Record<string, unknown>,
  TFullDocumentBeforeChange = Record<string, unknown>,
> {
  filters: Omit<DocumentDBFilters, 'operationType'>;
  documentKeySchema?: StandardSchemaV1<unknown, TDocumentKey>;
  fullDocumentSchema?: StandardSchemaV1<unknown, TFullDocument>;
  fullDocumentBeforeChangeSchema?: StandardSchemaV1<unknown, TFullDocumentBeforeChange>;
  middleware?: DocumentDBMiddleware<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>[];
  handler: (request: DocumentDBReplaceRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>) => Promise<void>;
}

export interface DocumentDBDeleteRouteDefinition<
  TDocumentKey = Record<string, unknown>,
  TFullDocumentBeforeChange = Record<string, unknown>,
> {
  filters: Omit<DocumentDBFilters, 'operationType'>;
  documentKeySchema?: StandardSchemaV1<unknown, TDocumentKey>;
  fullDocumentBeforeChangeSchema?: StandardSchemaV1<unknown, TFullDocumentBeforeChange>;
  middleware?: DocumentDBMiddleware<TDocumentKey, Record<string, unknown>, TFullDocumentBeforeChange>[];
  handler: (request: DocumentDBDeleteRequest<TDocumentKey, TFullDocumentBeforeChange>) => Promise<void>;
}

export interface DocumentDBRouteDefinition<
  TDocumentKey = Record<string, unknown>,
  TFullDocument = Record<string, unknown>,
  TFullDocumentBeforeChange = Record<string, unknown>,
> {
  filters: DocumentDBFilters;
  documentKeySchema?: StandardSchemaV1<unknown, TDocumentKey>;
  fullDocumentSchema?: StandardSchemaV1<unknown, TFullDocument>;
  fullDocumentBeforeChangeSchema?: StandardSchemaV1<unknown, TFullDocumentBeforeChange>;
  middleware?: DocumentDBMiddleware<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>[];
  handler: DocumentDBRecordHandler<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>;
}

export interface DocumentDBRouterOptions {
  middleware?: DocumentDBMiddleware[];
}
